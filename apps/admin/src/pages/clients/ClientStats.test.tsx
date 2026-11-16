// @vitest-environment jsdom
import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApi, unwrap } from "@/lib/api/client";
import { STATS_LOAD_FAILED, STATS_OFFLINE } from "@/lib/data/clientVisits";

import { ClientStats } from "./ClientStats";

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

function stats(over: Record<string, unknown> = {}) {
  return {
    visits: 6,
    totalSpent: 52000,
    noShows: 0,
    lastVisitAt: null,
    nextAppointmentAt: null,
    visitIntervalDays: 14,
    ...over,
  };
}

function renderStats() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ClientStats clientId="c1" />
    </QueryClientProvider>,
  );
}

function texts(role: "term" | "definition"): string[] {
  return screen.getAllByRole(role).map((el) => el.textContent ?? "");
}

beforeEach(() => {
  respond.mockReset();
});

afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
});

describe("ClientStats", () => {
  it("shows a skeleton while loading", () => {
    respond.mockReturnValue(new Promise<Response>(() => {}));
    const { container } = renderStats();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("shows visits, total spent and interval", async () => {
    respond.mockResolvedValue(jsonResponse(stats()));
    renderStats();

    await screen.findAllByRole("term");
    expect(texts("term")).toEqual(["визитов", "всего", "ходит раз в"]);
    expect(texts("definition")).toEqual(["6", "52 тыс.", "2 нед."]);
    expect(respond.mock.calls[0]?.[0].method).toBe("GET");
    expect(respond.mock.calls[0]?.[0].url).toBe("https://api.test/clients/c1/stats");
  });

  it("declines the visits label for one visit", async () => {
    respond.mockResolvedValue(jsonResponse(stats({ visits: 1 })));
    renderStats();

    await screen.findAllByRole("term");
    expect(texts("term")[0]).toBe("визит");
  });

  it("shows dashes for a client without visits", async () => {
    respond.mockResolvedValue(
      jsonResponse(stats({ visits: 0, totalSpent: 0, visitIntervalDays: null })),
    );
    renderStats();

    await screen.findAllByRole("term");
    expect(texts("definition")).toEqual(["0", "—", "—"]);
  });

  it("shows an error with retry and recovers", async () => {
    respond.mockResolvedValueOnce(jsonResponse({ message: "fail" }, 500));
    renderStats();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(STATS_LOAD_FAILED);
    expect(alert.textContent).toContain("Сервер ответил с ошибкой. Код: 500.");

    respond.mockResolvedValueOnce(jsonResponse(stats()));
    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
    await screen.findAllByRole("term");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the offline text without a request", () => {
    onlineManager.setOnline(false);
    renderStats();

    expect(screen.getByRole("status").textContent).toBe(STATS_OFFLINE);
    expect(respond).not.toHaveBeenCalled();
  });
});
