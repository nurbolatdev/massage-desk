// @vitest-environment jsdom
import { createRef } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

import type { Client } from "@/lib/data/clients";

import { ClientsTable } from "./ClientsTable";

afterEach(cleanup);

function makeClient(over: Partial<Client> = {}): Client {
  return {
    id: "c1",
    phone: "+77012345678",
    name: "Айгуль Сапарова",
    notes: null,
    createdAt: "2025-10-12T10:00:00+05:00",
    ...over,
  };
}

describe("ClientsTable", () => {
  it("renders the accessible table name and column headers", () => {
    render(<ClientsTable clients={[makeClient()]} />);

    const table = screen.getByRole("table", { name: "Клиенты" });
    const headers = within(table).getAllByRole("columnheader");
    expect(headers.map((header) => header.textContent)).toEqual([
      "Клиент",
      "Клиент с",
    ]);
  });

  it("renders initials, name, phone and formatted join date for named clients", () => {
    render(<ClientsTable clients={[makeClient()]} />);

    const row = screen.getAllByRole("row")[1]!;
    expect(within(row).getByText("АС")).toBeTruthy();
    expect(within(row).getByText("Айгуль Сапарова")).toBeTruthy();
    expect(within(row).getByText("+77012345678")).toBeTruthy();
    expect(within(row).getByText("12 окт. 2025 г.")).toBeTruthy();
  });

  it("shows the phone once and renders no initials when name is missing", () => {
    render(
      <ClientsTable
        clients={[
          makeClient({ id: "c-null", name: null, phone: "+77025550134" }),
          makeClient({ id: "c-blank", name: "   ", phone: "+77078801290" }),
        ]}
      />,
    );

    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]!).getAllByText("+77025550134")).toHaveLength(1);
    expect(rows[0]!.querySelector("svg")).not.toBeNull();
    expect(within(rows[1]!).getAllByText("+77078801290")).toHaveLength(1);
    expect(rows[1]!.querySelector("svg")).not.toBeNull();
  });

  it("preserves the input row order", () => {
    render(
      <ClientsTable
        clients={[
          makeClient({ id: "c1", name: "Айгуль Сапарова" }),
          makeClient({
            id: "c2",
            name: "Ержан Бекенов",
            phone: "+77025550134",
          }),
          makeClient({
            id: "c3",
            name: "Светлана Петрова",
            phone: "+77078801290",
          }),
        ]}
      />,
    );

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Айгуль Сапарова"),
      expect.stringContaining("Ержан Бекенов"),
      expect.stringContaining("Светлана Петрова"),
    ]);
  });

  it("attaches tableRef to the unclipped wrapper and supports programmatic focus", () => {
    const tableRef = createRef<HTMLElement | null>();
    render(<ClientsTable clients={[makeClient()]} tableRef={tableRef} />);

    const table = screen.getByRole("table", { name: "Клиенты" });
    expect(tableRef.current).not.toBe(table);
    expect(tableRef.current?.contains(table)).toBe(true);
    expect(tableRef.current?.classList.contains("overflow-x-auto")).toBe(false);

    tableRef.current?.focus();
    expect(document.activeElement).toBe(tableRef.current);
  });
});
