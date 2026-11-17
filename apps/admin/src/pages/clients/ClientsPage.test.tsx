// @vitest-environment jsdom
import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
  type InfiniteData,
} from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApi, unwrap } from "@/lib/api/client";
import {
  EMPTY_TEXT,
  EMPTY_TITLE,
  LOAD_FAILED,
  MORE_FAILED,
  NOT_FOUND_TEXT,
  NOTE_FIELD_LABEL,
  NOTE_SAVED,
  NOTE_SAVE_LABEL,
  PICK_CLIENT,
  PROFILE_LABEL,
  SEARCH_LABEL,
  SEARCH_OFFLINE,
  SEARCH_PLACEHOLDER,
  SHOW_MORE,
  type Client,
} from "@/lib/data/clients";
import { queryKeys } from "@/lib/data/queryKeys";

import { ClientsPage } from "./ClientsPage";

const respond = vi.hoisted(() => vi.fn<(r: Request) => Promise<Response>>());
const listReply = vi.hoisted(() => vi.fn<(r: Request) => Promise<Response>>());

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
  return {
    ...render(
      <QueryClientProvider client={client}>
        <ClientsPage />
      </QueryClientProvider>,
    ),
    queryClient: client,
  };
}

function requestParams(): Array<{
  q: string | null;
  limit: string | null;
  offset: string | null;
}> {
  return listReply.mock.calls.map(([req]) => {
    const url = new URL(req.url);
    return {
      q: url.searchParams.get("q"),
      limit: url.searchParams.get("limit"),
      offset: url.searchParams.get("offset"),
    };
  });
}

beforeEach(() => {
  listReply.mockReset();
  respond.mockReset();
  respond.mockImplementation((req) => {
    const path = new URL(req.url).pathname;
    if (path.endsWith("/stats")) {
      return Promise.resolve(
        jsonResponse({
          visits: 0,
          totalSpent: 0,
          noShows: 0,
          lastVisitAt: null,
          nextAppointmentAt: null,
          visitIntervalDays: null,
        }),
      );
    }
    if (path.endsWith("/appointments")) return Promise.resolve(jsonResponse([]));
    return listReply(req);
  });
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
    listReply.mockResolvedValueOnce(jsonResponse(rows));

    const { container } = renderPage();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();

    expect(
      await screen.findByRole("heading", { name: "Клиенты" }),
    ).not.toBeNull();
    const table = await screen.findByRole("table", { name: "Клиенты" });
    expect(within(table).getAllByRole("row")).toHaveLength(4);
    expect(screen.queryByRole("button", { name: SHOW_MORE })).toBeNull();
    expect(requestParams()).toEqual([{ q: null, limit: "50", offset: "0" }]);
  });

  it("shows empty state when API returns no clients without search", async () => {
    listReply.mockResolvedValueOnce(jsonResponse([]));

    renderPage();

    expect(await screen.findByText(EMPTY_TITLE)).not.toBeNull();
    expect(screen.getByText(EMPTY_TEXT)).not.toBeNull();
  });

  it("debounces search input, trims query, and keeps focus on searchbox", async () => {
    const initial = [
      makeClient("c1", "Айгуль Сапарова"),
      makeClient("c2", "Ержан Бекенов"),
    ];
    const filtered = [makeClient("c1", "Айгуль Сапарова")];
    listReply.mockImplementation(async (req) => {
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
    const initial = [
      makeClient("c1", "Айгуль Сапарова"),
      makeClient("c2", "Ержан Бекенов"),
    ];
    listReply.mockImplementation(async (req) => {
      const q = new URL(req.url).searchParams.get("q");
      return jsonResponse(q ? [] : initial);
    });

    renderPage();
    await screen.findByRole("table", { name: "Клиенты" });

    const searchbox = screen.getByRole("searchbox", { name: SEARCH_LABEL });
    fireEvent.change(searchbox, { target: { value: "zzz" } });

    expect(
      await screen.findByText("По запросу «zzz» ничего нет"),
    ).not.toBeNull();
    expect(screen.getByText(NOT_FOUND_TEXT)).not.toBeNull();

    fireEvent.change(searchbox, { target: { value: "" } });

    const table = await screen.findByRole("table", { name: "Клиенты" });
    expect(within(table).getAllByRole("row")).toHaveLength(3);
  });

  it("loads next page on Show more and focuses table when list ends", async () => {
    const page1 = Array.from({ length: 50 }, (_, i) => makeClient(`p1-${i}`));
    const page2 = Array.from({ length: 10 }, (_, i) => makeClient(`p2-${i}`));
    listReply.mockImplementation(async (req) => {
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
    expect(document.activeElement).toBe(
      screen.getByRole("region", { name: "Клиенты" }),
    );
  });

  it("keeps existing rows on Show more error and retries successfully", async () => {
    const page1 = Array.from({ length: 50 }, (_, i) => makeClient(`p1-${i}`));
    const page2 = Array.from({ length: 10 }, (_, i) => makeClient(`p2-${i}`));
    let nextCalls = 0;
    listReply.mockImplementation(async (req) => {
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
    expect(showMore.getAttribute("aria-disabled")).toBe("false");

    fireEvent.click(showMore);
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: SHOW_MORE })).toBeNull();
    });
    expect(within(table).getAllByRole("row")).toHaveLength(61);
  });

  it("shows error state with retry on 500 and network failure", async () => {
    const rows = [makeClient("c1", "Айгуль Сапарова")];
    listReply
      .mockResolvedValueOnce(jsonResponse({ message: "err" }, 500))
      .mockResolvedValueOnce(jsonResponse(rows));

    renderPage();
    expect(await screen.findByText(LOAD_FAILED)).not.toBeNull();
    expect(
      screen.getByText("Сервер ответил с ошибкой. Код: 500."),
    ).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
    expect(
      await screen.findByRole("table", { name: "Клиенты" }),
    ).not.toBeNull();

    cleanup();
    listReply.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    renderPage();
    expect(await screen.findByText(LOAD_FAILED)).not.toBeNull();
    expect(
      screen.getByText(
        "Нет связи с сервером. Проверьте интернет и нажмите «Повторить».",
      ),
    ).not.toBeNull();
  });

  it("keeps focus on Show more while more pages remain and ignores repeated clicks", async () => {
    const page1 = Array.from({ length: 50 }, (_, i) => makeClient(`p1-${i}`));
    const page2 = Array.from({ length: 50 }, (_, i) => makeClient(`p2-${i}`));
    let release: (r: Response) => void = () => {};
    listReply.mockImplementation((req) => {
      if (new URL(req.url).searchParams.get("offset") === "50") {
        return new Promise<Response>((resolve) => {
          release = resolve;
        });
      }
      return Promise.resolve(jsonResponse(page1));
    });

    renderPage();
    const showMore = await screen.findByRole("button", { name: SHOW_MORE });
    showMore.focus();
    fireEvent.click(showMore);
    await waitFor(() =>
      expect(showMore.getAttribute("aria-disabled")).toBe("true"),
    );
    fireEvent.click(showMore);
    expect(requestParams().filter((p) => p.offset === "50")).toHaveLength(1);

    release(jsonResponse(page2));
    await waitFor(() =>
      expect(showMore.getAttribute("aria-disabled")).toBe("false"),
    );
    expect(document.activeElement).toBe(showMore);
  });

  it("does not steal focus from the search field when the term changes during loading more", async () => {
    const page1 = Array.from({ length: 50 }, (_, i) => makeClient(`p1-${i}`));
    let release: (r: Response) => void = () => {};
    listReply.mockImplementation((req) => {
      const params = new URL(req.url).searchParams;
      if (params.get("offset") === "50") {
        return new Promise<Response>((resolve) => {
          release = resolve;
        });
      }
      return Promise.resolve(
        jsonResponse(params.get("q") ? [makeClient("c1")] : page1),
      );
    });

    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: SHOW_MORE }));
    await waitFor(() =>
      expect(requestParams().some((p) => p.offset === "50")).toBe(true),
    );

    const searchbox = screen.getByRole("searchbox", { name: SEARCH_LABEL });
    searchbox.focus();
    fireEvent.change(searchbox, { target: { value: "Айг" } });
    await waitFor(() =>
      expect(requestParams().some((p) => p.q === "Айг")).toBe(true),
    );

    release(jsonResponse([makeClient("p2-0")]));
    await screen.findByRole("table", { name: "Клиенты" });
    expect(document.activeElement).toBe(searchbox);
  });

  it("marks Show more unavailable when offline", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const page1 = Array.from({ length: 50 }, (_, i) => makeClient(`p1-${i}`));
    listReply.mockResolvedValueOnce(jsonResponse(page1));

    renderPage();
    const showMore = await screen.findByRole("button", { name: SHOW_MORE });
    expect(showMore.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(showMore);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(requestParams()).toHaveLength(1);
    expect(showMore.getAttribute("aria-disabled")).toBe("true");
  });

  it("shows offline search status and sends no q request when searching offline", async () => {
    const rows = [makeClient("c1", "Айгуль Сапарова")];
    listReply.mockResolvedValueOnce(jsonResponse(rows));

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

  it("shows the profile prompt with no selected row after loading", async () => {
    const rows = [
      makeClient("c1", "Айгуль Сапарова"),
      makeClient("c2", "Ержан Бекенов"),
    ];
    listReply.mockResolvedValueOnce(jsonResponse(rows));

    renderPage();
    const table = await screen.findByRole("table", { name: "Клиенты" });
    const panel = screen.getByRole("complementary", { name: PROFILE_LABEL });
    expect(within(panel).getByText(PICK_CLIENT)).not.toBeNull();

    for (const button of within(table).getAllByRole("button")) {
      expect(button.getAttribute("aria-current")).toBeNull();
    }
  });

  it("selects a client, focuses the profile heading, and loads a fresh note", async () => {
    const rows = [
      { ...makeClient("c1", "Айгуль Сапарова"), notes: "Старая заметка" },
      makeClient("c2", "Ержан Бекенов"),
    ];
    const fresh = { ...rows[0]!, notes: "Свежая заметка" };
    listReply.mockImplementation(async (req) => {
      const path = new URL(req.url).pathname;
      if (path === "/clients/c1") return jsonResponse(fresh);
      return jsonResponse(rows);
    });

    renderPage();
    const table = await screen.findByRole("table", { name: "Клиенты" });
    const rowButton = within(table).getByRole("button", {
      name: /Айгуль Сапарова/,
    });
    fireEvent.click(rowButton);

    expect(rowButton.getAttribute("aria-current")).toBe("true");
    const panel = screen.getByRole("complementary", { name: PROFILE_LABEL });
    const heading = within(panel).getByRole("heading", {
      name: "Айгуль Сапарова",
    });
    expect(document.activeElement).toBe(heading);

    const noteField = (await within(panel).findByLabelText(
      NOTE_FIELD_LABEL,
    )) as HTMLTextAreaElement;
    expect(noteField.value).toBe("Свежая заметка");
    expect(
      listReply.mock.calls.some(
        ([req]) =>
          req.method === "GET" && new URL(req.url).pathname === "/clients/c1",
      ),
    ).toBe(true);
  });

  it("saves a note, updates the list cache, and preserves it when switching back", async () => {
    const store = new Map<string, Client>([
      ["c1", makeClient("c1", "Айгуль Сапарова")],
      ["c2", { ...makeClient("c2", "Ержан Бекенов"), notes: "Заметка Ержана" }],
    ]);
    listReply.mockImplementation(async (req) => {
      const path = new URL(req.url).pathname;
      if (req.method === "PATCH" && path === "/clients/c1") {
        const body = (await req.json()) as { notes: string };
        const updated = { ...store.get("c1")!, notes: body.notes };
        store.set("c1", updated);
        return jsonResponse(updated);
      }
      if (path === "/clients/c1") return jsonResponse(store.get("c1"));
      if (path === "/clients/c2") return jsonResponse(store.get("c2"));
      return jsonResponse([...store.values()]);
    });

    const { queryClient } = renderPage();
    const table = await screen.findByRole("table", { name: "Клиенты" });

    fireEvent.click(
      within(table).getByRole("button", { name: /Айгуль Сапарова/ }),
    );
    const panel = screen.getByRole("complementary", { name: PROFILE_LABEL });
    const noteField = (await within(panel).findByLabelText(
      NOTE_FIELD_LABEL,
    )) as HTMLTextAreaElement;

    fireEvent.change(noteField, { target: { value: "Любит тёплое масло" } });
    fireEvent.click(
      within(panel).getByRole("button", { name: NOTE_SAVE_LABEL }),
    );

    await waitFor(() => {
      expect(within(panel).getByRole("status").textContent).toBe(NOTE_SAVED);
    });

    const cached = queryClient.getQueryData<InfiniteData<Client[]>>(
      queryKeys.clients.list("", "all"),
    );
    expect(cached?.pages[0]?.find((c) => c.id === "c1")?.notes).toBe(
      "Любит тёплое масло",
    );

    fireEvent.click(
      within(table).getByRole("button", { name: /Ержан Бекенов/ }),
    );
    await waitFor(() => {
      const field = within(panel).getByLabelText(
        NOTE_FIELD_LABEL,
      ) as HTMLTextAreaElement;
      expect(field.value).toBe("Заметка Ержана");
    });

    fireEvent.click(
      within(table).getByRole("button", { name: /Айгуль Сапарова/ }),
    );
    await waitFor(() => {
      const field = within(panel).getByLabelText(
        NOTE_FIELD_LABEL,
      ) as HTMLTextAreaElement;
      expect(field.value).toBe("Любит тёплое масло");
    });
  });

  it("hides the card when search is empty, restores selection on clear, and prompts when filtered out", async () => {
    const c1 = makeClient("c1", "Айгуль Сапарова");
    const c2 = makeClient("c2", "Ержан Бекенов");
    listReply.mockImplementation(async (req) => {
      const url = new URL(req.url);
      if (url.pathname === "/clients/c1") return jsonResponse(c1);
      const q = url.searchParams.get("q");
      if (q === "zzz") return jsonResponse([]);
      if (q === "Ерж") return jsonResponse([c2]);
      return jsonResponse([c1, c2]);
    });

    renderPage();
    const table = await screen.findByRole("table", { name: "Клиенты" });
    fireEvent.click(
      within(table).getByRole("button", { name: /Айгуль Сапарова/ }),
    );
    await screen.findByLabelText(NOTE_FIELD_LABEL);

    const searchbox = screen.getByRole("searchbox", { name: SEARCH_LABEL });
    fireEvent.change(searchbox, { target: { value: "zzz" } });
    expect(await screen.findByText(NOT_FOUND_TEXT)).not.toBeNull();
    expect(
      screen.queryByRole("complementary", { name: PROFILE_LABEL }),
    ).toBeNull();

    fireEvent.change(searchbox, { target: { value: "" } });
    const restoredPanel = await screen.findByRole("complementary", {
      name: PROFILE_LABEL,
    });
    expect(
      within(restoredPanel).getByRole("heading", { name: "Айгуль Сапарова" }),
    ).not.toBeNull();

    fireEvent.change(searchbox, { target: { value: "Ерж" } });
    await waitFor(() => {
      const panel = screen.getByRole("complementary", { name: PROFILE_LABEL });
      expect(within(panel).getByText(PICK_CLIENT)).not.toBeNull();
    });
  });

  it("does not render the profile panel on empty list or initial load error", async () => {
    listReply.mockResolvedValueOnce(jsonResponse([]));
    renderPage();
    expect(await screen.findByText(EMPTY_TITLE)).not.toBeNull();
    expect(
      screen.queryByRole("complementary", { name: PROFILE_LABEL }),
    ).toBeNull();

    cleanup();
    listReply.mockResolvedValueOnce(jsonResponse({ message: "err" }, 500));
    renderPage();
    expect(await screen.findByText(LOAD_FAILED)).not.toBeNull();
    expect(
      screen.queryByRole("complementary", { name: PROFILE_LABEL }),
    ).toBeNull();
  });
});
