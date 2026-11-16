// @vitest-environment jsdom
import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApi, unwrap } from "@/lib/api/client";
import {
  EMPTY_TEXT,
  EMPTY_TITLE,
  LOAD_FAILED,
  MORE_FAILED,
  NOT_FOUND_TEXT,
  SEARCH_LABEL,
  SEARCH_OFFLINE,
  SEARCH_PLACEHOLDER,
  SHOW_MORE,
  type Client,
} from "@/lib/data/clients";

import { ClientsPage } from "./ClientsPage";

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

function makeClient(id: string, name: string | null = `Клиент ${id}`): Client {
  return {
    id,
    phone: `+7701000${id.slice(-4).padStart(4, "0")}`,
    name,
    notes: null,
    createdAt: "2025-10-12T10:00:00+05:00",
  };
}

function jsonResponse(payload: unknown, status = 200): Response {
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
      <ClientsPage />
    </QueryClientProvider>,
  );
}

function requestParams(): Array<{ q: string | null; limit: string | null; offset: string | null }> {
  return respond.mock.calls.map(([req]) => {
    const url = new URL(req.url);
    return {
      q: url.searchParams.get("q"),
      limit: url.searchParams.get("limit"),
      offset: url.searchParams.get("offset"),
    };
  });
}

beforeEach(() => {
  respond.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  onlineManager.setOnline(true);
});

describe("ClientsPage", () => {
  it("shows skeleton while loading and then renders the clients table without Show more", async () => {
    const rows = [
      makeClient("c1", "Айгуль Сапарова"),
      makeClient("c2", "Ержан Бекенов"),
      makeClient("c3", "Марат Каримов"),
    ];
    respond.mockResolvedValueOnce(jsonResponse(rows));

    const { container } = renderPage();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();

    expect(await screen.findByRole("heading", { name: "Клиенты" })).not.toBeNull();
    const table = await screen.findByRole("table", { name: "Клиенты" });
    expect(within(table).getAllByRole("row")).toHaveLength(4);
    expect(screen.queryByRole("button", { name: SHOW_MORE })).toBeNull();
    expect(requestParams()).toEqual([{ q: null, limit: "50", offset: "0" }]);
  });

  it("shows empty state when API returns no clients without search", async () => {
    respond.mockResolvedValueOnce(jsonResponse([]));

    renderPage();

    expect(await screen.findByText(EMPTY_TITLE)).not.toBeNull();
    expect(screen.getByText(EMPTY_TEXT)).not.toBeNull();
  });

  it("debounces search input, trims query, and keeps focus on searchbox", async () => {
    const initial = [makeClient("c1", "Айгуль Сапарова"), makeClient("c2", "Ержан Бекенов")];
    const filtered = [makeClient("c1", "Айгуль Сапарова")];
    respond.mockImplementation(async (req) => {
      const q = new URL(req.url).searchParams.get("q");
      return jsonResponse(q === "Айг" ? filtered : initial);
    });

    renderPage();
    await screen.findByRole("table", { name: "Клиенты" });

    const searchbox = screen.getByRole("searchbox", { name: SEARCH_LABEL });
    expect(searchbox.getAttribute("placeholder")).toBe(SEARCH_PLACEHOLDER);

    searchbox.focus();
    fireEvent.change(searchbox, { target: { value: "А" } });
    fireEvent.change(searchbox, { target: { value: "Ай" } });
    fireEvent.change(searchbox, { target: { value: " Айг " } });

    await waitFor(() => {
      const withQ = requestParams().filter((p) => p.q !== null);
      expect(withQ).toEqual([{ q: "Айг", limit: "50", offset: "0" }]);
    });

    const table = await screen.findByRole("table", { name: "Клиенты" });
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    expect(document.activeElement).toBe(searchbox);
  });

  it("shows not-found state for empty search results and restores list when cleared", async () => {
    const initial = [makeClient("c1", "Айгуль Сапарова"), makeClient("c2", "Ержан Бекенов")];
    respond.mockImplementation(async (req) => {
      const q = new URL(req.url).searchParams.get("q");
      return jsonResponse(q ? [] : initial);
    });

    renderPage();
    await screen.findByRole("table", { name: "Клиенты" });

    const searchbox = screen.getByRole("searchbox", { name: SEARCH_LABEL });
    fireEvent.change(searchbox, { target: { value: "zzz" } });

    expect(await screen.findByText("По запросу «zzz» ничего нет")).not.toBeNull();
    expect(screen.getByText(NOT_FOUND_TEXT)).not.toBeNull();

    fireEvent.change(searchbox, { target: { value: "" } });

    const table = await screen.findByRole("table", { name: "Клиенты" });
    expect(within(table).getAllByRole("row")).toHaveLength(3);
  });

  it("loads next page on Show more and focuses table when list ends", async () => {
    const page1 = Array.from({ length: 50 }, (_, i) => makeClient(`p1-${i}`));
    const page2 = Array.from({ length: 10 }, (_, i) => makeClient(`p2-${i}`));
    respond.mockImplementation(async (req) => {
      const offset = new URL(req.url).searchParams.get("offset");
      return jsonResponse(offset === "50" ? page2 : page1);
    });

    renderPage();
    const showMore = await screen.findByRole("button", { name: SHOW_MORE });
    fireEvent.click(showMore);

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: SHOW_MORE })).toBeNull();
    });

    const table = screen.getByRole("table", { name: "Клиенты" });
    expect(within(table).getAllByRole("row")).toHaveLength(61);
    expect(requestParams().map((p) => p.offset)).toEqual(["0", "50"]);
    expect(document.activeElement).toBe(table);
  });

  it("keeps existing rows on Show more error and retries successfully", async () => {
    const page1 = Array.from({ length: 50 }, (_, i) => makeClient(`p1-${i}`));
    const page2 = Array.from({ length: 10 }, (_, i) => makeClient(`p2-${i}`));
    let nextCalls = 0;
    respond.mockImplementation(async (req) => {
      const offset = new URL(req.url).searchParams.get("offset");
      if (offset !== "50") return jsonResponse(page1);
      nextCalls += 1;
      if (nextCalls === 1) return jsonResponse({ message: "boom" }, 500);
      return jsonResponse(page2);
    });

    renderPage();
    const showMore = await screen.findByRole("button", { name: SHOW_MORE });
    fireEvent.click(showMore);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(MORE_FAILED);
    const table = screen.getByRole("table", { name: "Клиенты" });
    expect(within(table).getAllByRole("row")).toHaveLength(51);
    expect((showMore as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(showMore);
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: SHOW_MORE })).toBeNull();
    });
    expect(within(table).getAllByRole("row")).toHaveLength(61);
  });

  it("shows error state with retry on 500 and network failure", async () => {
    const rows = [makeClient("c1", "Айгуль Сапарова")];
    respond
      .mockResolvedValueOnce(jsonResponse({ message: "err" }, 500))
      .mockResolvedValueOnce(jsonResponse(rows));

    renderPage();
    expect(await screen.findByText(LOAD_FAILED)).not.toBeNull();
    expect(screen.getByText("Сервер ответил с ошибкой. Код: 500.")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
    expect(await screen.findByRole("table", { name: "Клиенты" })).not.toBeNull();

    cleanup();
    respond.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    renderPage();
    expect(await screen.findByText(LOAD_FAILED)).not.toBeNull();
    expect(
      screen.getByText("Нет связи с сервером. Проверьте интернет и нажмите «Повторить»."),
    ).not.toBeNull();
  });

  it("disables Show more when offline", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const page1 = Array.from({ length: 50 }, (_, i) => makeClient(`p1-${i}`));
    respond.mockResolvedValueOnce(jsonResponse(page1));

    renderPage();
    const showMore = (await screen.findByRole("button", { name: SHOW_MORE })) as HTMLButtonElement;
    expect(showMore.disabled).toBe(true);
  });

  it("shows offline search status and sends no q request when searching offline", async () => {
    const rows = [makeClient("c1", "Айгуль Сапарова")];
    respond.mockResolvedValueOnce(jsonResponse(rows));

    renderPage();
    await screen.findByRole("table", { name: "Клиенты" });

    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    onlineManager.setOnline(false);

    const searchbox = screen.getByRole("searchbox", { name: SEARCH_LABEL });
    fireEvent.change(searchbox, { target: { value: "Айг" } });

    const status = await screen.findByRole("status");
    expect(status.textContent).toBe(SEARCH_OFFLINE);
    expect(requestParams().every((p) => p.q === null)).toBe(true);
  });
});
