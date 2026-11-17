import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/errors";

import {
  CLIENTS_PAGE_SIZE,
  type Client,
  clientInitials,
  clientName,
  clientSince,
  clientSinceText,
  blockView,
  clientsView,
  hasName,
  nextOffset,
  NOTE_SAVE_FAILED,
  noteSaveErrorText,
  notFoundTitle,
  replaceInPages,
  uniqueById,
} from "./clients";

function makeClient(id: string, overrides: Partial<Client> = {}): Client {
  return {
    id,
    phone: "+77012345678",
    name: "Айгуль Сапарова",
    notes: null,
    createdAt: "2025-10-12T10:00:00+05:00",
    ...overrides,
  };
}

function makePage(prefix: string, count: number): Client[] {
  return Array.from({ length: count }, (_, i) => makeClient(`${prefix}-${i}`));
}

describe("nextOffset", () => {
  it("stops when the last page is shorter than page size", () => {
    const short = makePage("a", 10);
    expect(nextOffset(short, [short])).toBeUndefined();
  });

  it("returns cumulative count while pages are full", () => {
    const p1 = makePage("a", CLIENTS_PAGE_SIZE);
    const p2 = makePage("b", CLIENTS_PAGE_SIZE);
    expect(nextOffset(p1, [p1])).toBe(50);
    expect(nextOffset(p2, [p1, p2])).toBe(100);
  });

  it("stops on an empty page after a full page", () => {
    const p1 = makePage("a", CLIENTS_PAGE_SIZE);
    expect(nextOffset([], [p1, []])).toBeUndefined();
  });
});

describe("clientName and hasName", () => {
  it("falls back to phone when name is null or whitespace", () => {
    expect(clientName({ name: null, phone: "+77010000001" })).toBe("+77010000001");
    expect(clientName({ name: "  ", phone: "+77010000001" })).toBe("+77010000001");
    expect(hasName({ name: null })).toBe(false);
    expect(hasName({ name: "  " })).toBe(false);
  });

  it("trims whitespace around the name", () => {
    expect(clientName({ name: "  Айгуль Сапарова  ", phone: "+77010000001" })).toBe("Айгуль Сапарова");
    expect(hasName({ name: "  Айгуль  " })).toBe(true);
  });
});

describe("clientInitials", () => {
  it("takes up to two uppercase initials or returns empty string", () => {
    expect(clientInitials("Айгуль Сапарова")).toBe("АС");
    expect(clientInitials("айгуль")).toBe("А");
    expect(clientInitials("Анна Мария Ли")).toBe("АМ");
    expect(clientInitials("  Ержан   Бекенов ")).toBe("ЕБ");
    expect(clientInitials(null)).toBe("");
    expect(clientInitials("")).toBe("");
  });
});

describe("clientSince", () => {
  it("uses the calendar day in the master's offset rather than UTC", () => {
    expect(clientSince("2025-10-13T01:00:00+05:00")).toBe("13 окт. 2025 г.");
  });
});

describe("clientsView", () => {
  it("picks loading, error, empty, notFound, and list states", () => {
    expect(clientsView({ hasData: false, error: null, count: 0, term: "", segment: "all" })).toBe("loading");
    expect(clientsView({ hasData: false, error: new Error("boom"), count: 0, term: "", segment: "all" })).toBe("error");
    expect(clientsView({ hasData: true, error: null, count: 0, term: "", segment: "all" })).toBe("empty");
    expect(clientsView({ hasData: true, error: null, count: 0, term: "Айг", segment: "all" })).toBe("notFound");
    expect(clientsView({ hasData: true, error: null, count: 3, term: "", segment: "all" })).toBe("list");
    expect(clientsView({ hasData: true, error: new Error("bg"), count: 3, term: "", segment: "all" })).toBe("list");
    expect(clientsView({ hasData: true, error: null, count: 0, term: "", segment: "regular" })).toBe("emptySegment");
    expect(clientsView({ hasData: true, error: null, count: 0, term: "Айг", segment: "regular" })).toBe("notFound");
  });
});

describe("notFoundTitle", () => {
  it("formats the query into the empty search title", () => {
    expect(notFoundTitle("Айдр")).toBe("По запросу «Айдр» ничего нет");
  });
});

describe("replaceInPages", () => {
  it("replaces the matching client in the second page and preserves other row references", () => {
    const c1 = makeClient("1");
    const c2 = makeClient("2");
    const c3 = makeClient("3", { notes: "старая" });
    const updated = makeClient("3", { notes: "новая" });

    const next = replaceInPages([[c1], [c2, c3]], updated);

    expect(next).toEqual([[c1], [c2, { ...c3, ...updated }]]);
    expect(next[0]?.[0]).toBe(c1);
    expect(next[1]?.[0]).toBe(c2);
  });

  it("keeps the stats of a list row when the saved client has none", () => {
    const stats = {
      visits: 6,
      lastVisitAt: null,
      nextAppointmentAt: null,
      noShows: 1,
      totalSpent: 0,
      visitIntervalDays: null,
    };
    const row = { ...makeClient("1", { notes: "старая" }), stats };
    const other = { ...makeClient("2"), stats };

    const next = replaceInPages([[row, other]], makeClient("1", { notes: "новая" }));

    expect(next[0]?.[0]).toEqual({ ...row, notes: "новая" });
    expect(next[0]?.[0]?.stats).toBe(stats);
    expect(next[0]?.[1]).toBe(other);
  });

  it("keeps page contents unchanged when no client matches the id", () => {
    const c1 = makeClient("1");
    const c2 = makeClient("2");
    const next = replaceInPages([[c1], [c2]], makeClient("99"));

    expect(next).toEqual([[c1], [c2]]);
    expect(next[0]?.[0]).toBe(c1);
    expect(next[1]?.[0]).toBe(c2);
  });
});

describe("clientSinceText", () => {
  it("formats the prefix and date in Russian", () => {
    expect(clientSinceText("2025-10-12T10:00:00+05:00")).toBe("Клиент с 12 окт. 2025 г.");
  });
});

describe("noteSaveErrorText", () => {
  it("formats network, server status, and unknown errors", () => {
    expect(noteSaveErrorText(new ApiError("network"))).toBe(NOTE_SAVE_FAILED);
    expect(noteSaveErrorText(new ApiError("server", { status: 500 }))).toBe(
      "Сервер ответил с ошибкой. Код: 500. Заметка не сохранена.",
    );
    expect(noteSaveErrorText(new Error("x"))).toBe(
      "Заметка не сохранена. Попробуйте ещё раз через минуту.",
    );
  });
});

describe("blockView", () => {
  it("picks loading, error, offline, and ready states with data > error > paused", () => {
    expect(blockView({ hasData: false, error: null, paused: false })).toBe("loading");
    expect(blockView({ hasData: false, error: new Error("boom"), paused: false })).toBe("error");
    expect(blockView({ hasData: false, error: null, paused: true })).toBe("offline");
    expect(blockView({ hasData: true, error: null, paused: false })).toBe("ready");
    expect(blockView({ hasData: true, error: new Error("bg"), paused: false })).toBe("ready");
    expect(blockView({ hasData: false, error: new Error("boom"), paused: true })).toBe("error");
  });
});

describe("uniqueById", () => {
  it("drops repeated ids and keeps first-seen order", () => {
    expect(uniqueById([[{ id: "a" }, { id: "b" }], [{ id: "a" }, { id: "c" }]])).toEqual([
      { id: "a" },
      { id: "b" },
      { id: "c" },
    ]);
  });
});
