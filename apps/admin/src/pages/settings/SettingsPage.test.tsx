// @vitest-environment jsdom
import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
});
