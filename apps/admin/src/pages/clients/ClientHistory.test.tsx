// @vitest-environment jsdom
import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApi, unwrap } from "@/lib/api/client";
import {
  HISTORY_EMPTY,
  HISTORY_LOAD_FAILED,
  HISTORY_MORE_FAILED,
  HISTORY_OFFLINE,
} from "@/lib/data/clientVisits";

import { ClientHistory } from "./ClientHistory";

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

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function item(id: string, status: string, start: string, end: string, serviceName = "Спина") {
  return {
    id,
    clientId: "c1",
    clientName: "Айгуль",
    clientPhone: "+77012345678",
    serviceId: "s1",
    serviceName,
    source: "bot",
    status,
    start,
    end,
  };
}

function renderHistory() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ClientHistory clientId="c1" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  respond.mockReset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-16T12:00:00+05:00"));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  onlineManager.setOnline(true);
});

describe("ClientHistory", () => {
  it("shows the title and a skeleton while loading", () => {
    respond.mockReturnValue(new Promise<Response>(() => {}));
    const { container } = renderHistory();

    expect(screen.getByRole("heading", { name: "История" })).toBeDefined();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("shows the empty text", async () => {
    respond.mockResolvedValue(jsonResponse([]));
    renderHistory();

    expect((await screen.findByText(HISTORY_EMPTY)).textContent).toBe(HISTORY_EMPTY);
    expect(respond.mock.calls[0]?.[0].url).toBe(
      "https://api.test/clients/c1/appointments?limit=10&offset=0",
    );
  });

  it("shows rows in response order with status words and colors", async () => {
    respond.mockResolvedValue(
      jsonResponse([
        item("a1", "done", "2026-10-12T10:00:00+05:00", "2026-10-12T11:00:00+05:00"),
        item("a2", "confirmed", "2026-10-05T10:00:00+05:00", "2026-10-05T11:00:00+05:00"),
        item("a3", "confirmed", "2026-11-16T11:30:00+05:00", "2026-11-16T12:30:00+05:00"),
        item("a4", "confirmed", "2026-11-20T10:00:00+05:00", "2026-11-20T11:00:00+05:00"),
        item("a5", "no_show", "2026-09-28T10:00:00+05:00", "2026-09-28T11:00:00+05:00"),
        item("a6", "cancelled", "2025-09-09T10:00:00+05:00", "2025-09-09T11:00:00+05:00", "Общий"),
      ]),
    );
    renderHistory();

    const rows = await screen.findAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      "12 окт. · СпинаПрошла",
      "5 окт. · СпинаПрошла",
      "16 нояб. · СпинаИдёт",
      "20 нояб. · СпинаЗапланирована",
      "28 сент. · СпинаНе пришёл",
      "9 сент. 2025 г. · ОбщийОтменена",
    ]);
    expect(screen.getAllByText("Не пришёл")[0]?.className).toContain("text-accent-strong");
    expect(screen.getAllByText("Прошла")[0]?.className).toContain("text-primary-strong");
  });

  it("shows an error with retry and recovers", async () => {
    respond.mockResolvedValueOnce(jsonResponse({ message: "fail" }, 500));
    renderHistory();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(HISTORY_LOAD_FAILED);

    respond.mockResolvedValueOnce(
      jsonResponse([item("a1", "done", "2026-10-12T10:00:00+05:00", "2026-10-12T11:00:00+05:00")]),
    );
    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
    await screen.findAllByRole("listitem");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the offline text without a request", () => {
    onlineManager.setOnline(false);
    renderHistory();

    expect(screen.getByRole("status").textContent).toBe(HISTORY_OFFLINE);
    expect(respond).not.toHaveBeenCalled();
  });
  describe("show more", () => {
    const page = (n: number, from = 0) =>
      Array.from({ length: n }, (_, i) =>
        item(
          `p${from + i}`,
          "done",
          "2026-10-12T10:00:00+05:00",
          "2026-10-12T11:00:00+05:00",
        ),
      );

    it("has no button when the first page is short", async () => {
      respond.mockResolvedValue(jsonResponse(page(6)));
      renderHistory();

      await screen.findAllByRole("listitem");
      expect(screen.queryByRole("button", { name: "Показать ещё" })).toBeNull();
    });

    it("loads the next page and focuses the list at the end", async () => {
      respond.mockResolvedValueOnce(jsonResponse(page(10)));
      respond.mockResolvedValueOnce(jsonResponse(page(3, 10)));
      renderHistory();

      await screen.findAllByRole("listitem");
      const button = screen.getByRole("button", { name: "Показать ещё" });
      button.focus();
      fireEvent.click(button);

      await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(13));
      expect(respond.mock.calls[1]?.[0].url).toBe(
        "https://api.test/clients/c1/appointments?limit=10&offset=10",
      );
      expect(screen.queryByRole("button", { name: "Показать ещё" })).toBeNull();
      expect(document.activeElement).toBe(screen.getByRole("list"));
    });

    it("keeps the rows on a failed load and retries", async () => {
      respond.mockResolvedValueOnce(jsonResponse(page(10)));
      respond.mockResolvedValueOnce(jsonResponse({ message: "fail" }, 500));
      renderHistory();

      await screen.findAllByRole("listitem");
      fireEvent.click(screen.getByRole("button", { name: "Показать ещё" }));

      expect((await screen.findByRole("alert")).textContent).toBe(HISTORY_MORE_FAILED);
      expect(screen.getAllByRole("listitem")).toHaveLength(10);

      respond.mockResolvedValueOnce(jsonResponse(page(3, 10)));
      fireEvent.click(screen.getByRole("button", { name: "Показать ещё" }));
      await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(13));
    });

    it("does not request when offline", async () => {
      respond.mockResolvedValueOnce(jsonResponse(page(10)));
      renderHistory();

      await screen.findAllByRole("listitem");
      vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
      onlineManager.setOnline(false);
      window.dispatchEvent(new Event("offline"));
      const button = screen.getByRole("button", { name: "Показать ещё" });
      await waitFor(() => expect(button.getAttribute("aria-disabled")).toBe("true"));
      fireEvent.click(button);

      expect(respond).toHaveBeenCalledTimes(1);
    });
  });
});
