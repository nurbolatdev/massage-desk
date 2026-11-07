import { describe, expect, it } from "@jest/globals";

import type { ClientResponse } from "./booking";
import { clientStatus, exactMatch, pickerView, searchQuery } from "./clientPicker";

const PHONE = "+998901234567";

function client(id: string, phone: string): ClientResponse {
  return { id, phone, name: "Айгуль" } as ClientResponse;
}

const base = {
  query: "901",
  online: true,
  results: [] as ClientResponse[],
  loading: false,
  failed: false,
  selectedId: null,
  newClient: false,
  phone: null,
};

describe("searchQuery", () => {
  it("needs 3 digits or 2 letters", () => {
    expect(searchQuery("90")).toBeNull();
    expect(searchQuery("901")).toBe("901");
    expect(searchQuery("Ай")).toBe("Ай");
    expect(searchQuery("  ")).toBeNull();
  });
});

describe("exactMatch", () => {
  it("finds the client with the same phone", () => {
    const list = [client("a", "+998900000000"), client("b", PHONE)];
    expect(exactMatch(list, PHONE)?.id).toBe("b");
    expect(exactMatch(list, null)).toBeUndefined();
  });
});

describe("pickerView", () => {
  it("is idle with the link when there is no query", () => {
    expect(pickerView({ ...base, query: null })).toEqual({
      kind: "idle",
      showNewLink: true,
      showNewInfo: false,
    });
  });

  it("is searching while loading", () => {
    expect(pickerView({ ...base, loading: true }).kind).toBe("searching");
  });

  it("is offline without results", () => {
    expect(pickerView({ ...base, online: false }).kind).toBe("offline");
  });

  it("is error when the search failed", () => {
    expect(pickerView({ ...base, failed: true }).kind).toBe("error");
  });

  it("is a new client with info for empty results and a valid phone", () => {
    expect(pickerView({ ...base, phone: PHONE })).toEqual({
      kind: "newClient",
      showNewLink: false,
      showNewInfo: true,
    });
  });

  it("is noMatch with the link for empty results and an invalid phone", () => {
    expect(pickerView(base)).toEqual({ kind: "noMatch", showNewLink: true, showNewInfo: false });
  });

  it("shows results with the link when there is no exact match", () => {
    const view = pickerView({ ...base, results: [client("a", "+998900000000")], phone: PHONE });
    expect(view).toEqual({ kind: "results", showNewLink: true, showNewInfo: false });
  });

  it("hides the link on an exact match", () => {
    const view = pickerView({ ...base, results: [client("a", PHONE)], phone: PHONE });
    expect(view).toEqual({ kind: "results", showNewLink: false, showNewInfo: false });
  });

  it("is selected when a client is picked", () => {
    const view = pickerView({ ...base, results: [client("a", PHONE)], selectedId: "a" });
    expect(view).toEqual({ kind: "selected", showNewLink: false, showNewInfo: false });
  });

  it("is a new client without info when chosen manually next to an exact match", () => {
    const view = pickerView({
      ...base,
      results: [client("a", PHONE)],
      phone: PHONE,
      newClient: true,
    });
    expect(view).toEqual({ kind: "newClient", showNewLink: false, showNewInfo: false });
  });
});

describe("clientStatus", () => {
  it("is none until a client is chosen", () => {
    expect(clientStatus({ kind: "idle", phone: null, name: "", selectedId: null })).toBe("none");
  });

  it("is ready for a picked client", () => {
    expect(clientStatus({ kind: "selected", phone: null, name: "", selectedId: "a" })).toBe("ready");
  });

  it("checks the phone of a new client", () => {
    expect(clientStatus({ kind: "newClient", phone: null, name: "Анна", selectedId: null })).toBe(
      "invalidPhone",
    );
  });

  it("asks for a name of a new client", () => {
    expect(clientStatus({ kind: "newClient", phone: PHONE, name: "  ", selectedId: null })).toBe(
      "needsName",
    );
  });

  it("is ready for a new client with phone and name", () => {
    expect(clientStatus({ kind: "newClient", phone: PHONE, name: "Анна", selectedId: null })).toBe(
      "ready",
    );
  });
});
