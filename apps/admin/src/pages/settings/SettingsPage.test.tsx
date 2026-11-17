// @vitest-environment jsdom
import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApi, unwrap } from "@/lib/api/client";
import {
  SERVICES_EMPTY,
  SERVICES_LOAD_FAILED,
  SERVICES_OFFLINE,
  formatDuration,
  formatPrice,
} from "@/lib/data/services";

import { SettingsPage } from "./SettingsPage";

const respond = vi.hoisted(() => vi.fn<(r: Request) => Promise<Response>>());

vi.mock("@/lib/api", () => ({
  api: createApi({
    baseUrl: "https://api.test",
    getAccessToken: async () => "tok",
    onUnauthorized: () => {},
    fetch: (r) => respond(r),
  }),
  unwrap,
}));

const back = { id: "s1", name: "Массаж спины", durationMin: 60, price: 8000, sortOrder: 1, active: true };
const legs = { id: "s2", name: "Массаж ног", durationMin: 45, price: 6000, sortOrder: 2, active: false };

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SettingsPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  respond.mockReset();
});

afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
});

describe("SettingsPage", () => {
  it("shows the headings and a skeleton while loading", () => {
    respond.mockReturnValue(new Promise(() => {}));
    const { container } = renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Настройки" })).not.toBeNull();
    expect(screen.getByText("Изменения сразу видит бот и приложение мастера")).not.toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: "Услуги и цены" })).not.toBeNull();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("lists active and hidden services in server order", async () => {
    respond.mockResolvedValue(json([back, legs]));
    renderPage();
    const table = await screen.findByRole("table", { name: "Услуги и цены" });
    const headers = within(table).getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual(["Услуга", "Длительность", "Цена", "Бот предлагает"]);
    const names = within(table).getAllByRole("rowheader");
    expect(names.map((n) => n.textContent)).toEqual(["Массаж спины", "Массаж ног"]);
    const [first, second] = within(table).getAllByRole("row").slice(1);
    expect(first?.textContent).toContain(formatDuration(60));
    expect(first?.textContent).toContain(formatPrice(8000));
    expect(first?.textContent).toContain("Да");
    expect(second?.textContent).toContain(formatDuration(45));
    expect(second?.textContent).toContain(formatPrice(6000));
    expect(second?.textContent).toContain("Нет, скрыта");
    expect(names[1]?.className).toContain("text-neutral-fg");
    expect(respond).toHaveBeenCalledTimes(1);
  });

  it("shows the empty text without a table", async () => {
    respond.mockResolvedValue(json([]));
    renderPage();
    expect(await screen.findByText(SERVICES_EMPTY)).not.toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows an error with a retry that loads the table", async () => {
    respond.mockResolvedValueOnce(json({}, 500));
    renderPage();
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(SERVICES_LOAD_FAILED)).not.toBeNull();
    expect(within(alert).getByText("Сервер ответил с ошибкой. Код: 500.")).not.toBeNull();
    respond.mockResolvedValue(json([back]));
    fireEvent.click(within(alert).getByRole("button", { name: "Повторить" }));
    expect(await screen.findByRole("table", { name: "Услуги и цены" })).not.toBeNull();
  });

  it("shows the offline text without requests", () => {
    onlineManager.setOnline(false);
    renderPage();
    expect(screen.getByRole("status").textContent).toBe(SERVICES_OFFLINE);
    expect(respond).not.toHaveBeenCalled();
  });
  describe("editing", () => {
    function serve(initial: unknown[]) {
      const list = [...initial] as { id: string }[];
      respond.mockImplementation(async (r) => {
        if (r.method === "GET") return json(list);
        const body = (await r.json()) as Record<string, unknown>;
        if (r.method === "PATCH") {
          const at = list.findIndex((x) => x.id === r.url.split("/").pop());
          const next = { ...list[at], ...body } as { id: string };
          list[at] = next;
          return json(next);
        }
        const created = { id: "s3", sortOrder: 3, active: true, ...body };
        list.push(created);
        return json(created);
      });
    }
    const writes = () => respond.mock.calls.map(([r]) => r).filter((r) => r.method !== "GET");

    it("shows add and edit buttons only when the list is ready", async () => {
      serve([back, legs]);
      renderPage();
      expect(await screen.findByRole("button", { name: "Добавить услугу" })).not.toBeNull();
      expect(screen.getByRole("button", { name: "Изменить: Массаж спины" })).not.toBeNull();
      expect(screen.getByRole("button", { name: "Изменить: Массаж ног" })).not.toBeNull();
    });

    it("offers adding on an empty list but not while loading or offline", async () => {
      serve([]);
      renderPage();
      expect(await screen.findByRole("button", { name: "Добавить услугу" })).not.toBeNull();
      cleanup();
      respond.mockReturnValue(new Promise(() => {}));
      renderPage();
      expect(screen.queryByRole("button", { name: "Добавить услугу" })).toBeNull();
      cleanup();
      onlineManager.setOnline(false);
      renderPage();
      expect(screen.queryByRole("button", { name: "Добавить услугу" })).toBeNull();
    });

    it("saves a changed price and returns focus to the edit button", async () => {
      serve([back, legs]);
      renderPage();
      const edit = await screen.findByRole("button", { name: "Изменить: Массаж спины" });
      fireEvent.click(edit);
      const dialog = await screen.findByRole("dialog", { name: "Услуга" });
      fireEvent.change(within(dialog).getByLabelText("Цена, ₸"), { target: { value: "9000" } });
      fireEvent.click(within(dialog).getByRole("button", { name: "Сохранить" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      const [patch] = writes();
      expect(patch?.method).toBe("PATCH");
      expect(patch?.url).toBe("https://api.test/services/s1");
      expect(screen.getByRole("status").textContent).toBe("Сохранено: «Массаж спины».");
      expect(within(screen.getByRole("table")).getAllByRole("row")[1]?.textContent).toContain(formatPrice(9000));
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Изменить: Массаж спины" }));
    });

    it("adds a service as the last row and returns focus to the add button", async () => {
      serve([back]);
      renderPage();
      fireEvent.click(await screen.findByRole("button", { name: "Добавить услугу" }));
      const dialog = await screen.findByRole("dialog", { name: "Новая услуга" });
      fireEvent.change(within(dialog).getByLabelText("Название"), { target: { value: "Массаж рук" } });
      fireEvent.change(within(dialog).getByLabelText("Длительность, мин"), { target: { value: "40" } });
      fireEvent.change(within(dialog).getByLabelText("Цена, ₸"), { target: { value: "7500" } });
      fireEvent.click(within(dialog).getByRole("button", { name: "Сохранить" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(writes()[0]?.method).toBe("POST");
      const names = within(screen.getByRole("table")).getAllByRole("rowheader");
      expect(names.map((n) => n.textContent)).toEqual(["Массаж спины", "Массаж рук"]);
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Добавить услугу" }));
    });

    it("hides a service from its dialog", async () => {
      serve([back]);
      renderPage();
      fireEvent.click(await screen.findByRole("button", { name: "Изменить: Массаж спины" }));
      fireEvent.click(await screen.findByRole("button", { name: "Скрыть услугу" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(screen.getByText("Нет, скрыта")).not.toBeNull();
      expect(screen.getByRole("status").textContent).toContain("скрыта");
    });

    it("closes with Escape without requests and keeps focus on the source button", async () => {
      serve([back]);
      renderPage();
      const edit = await screen.findByRole("button", { name: "Изменить: Массаж спины" });
      fireEvent.click(edit);
      const dialog = await screen.findByRole("dialog", { name: "Услуга" });
      fireEvent.keyDown(dialog, { key: "Escape" });
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(writes()).toHaveLength(0);
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Изменить: Массаж спины" }));
    });
  });
});
