// @vitest-environment jsdom
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import type { ClientListItem } from "@/lib/data/clients";

import { ClientsTable } from "./ClientsTable";

afterEach(cleanup);

function makeClient(
  over: Partial<Omit<ClientListItem, "stats">> = {},
  stats: Partial<ClientListItem["stats"]> = {},
): ClientListItem {
  return {
    id: "c1",
    phone: "+77012345678",
    name: "Айгуль Сапарова",
    notes: null,
    createdAt: "2025-10-12T10:00:00+05:00",
    stats: {
      visits: 0,
      totalSpent: 0,
      noShows: 0,
      lastVisitAt: null,
      nextAppointmentAt: null,
      visitIntervalDays: null,
      ...stats,
    },
    ...over,
  };
}

describe("ClientsTable", () => {
  it("renders the accessible table name and column headers", () => {
    render(<ClientsTable clients={[makeClient()]} selectedId={null} onSelect={() => {}}
        today="2026-11-16"
        year={2026} />);

    const table = screen.getByRole("table", { name: "Клиенты" });
    const headers = within(table).getAllByRole("columnheader");
    expect(headers.map((header) => header.textContent)).toEqual([
      "Клиент",
      "Визитов",
      "Последний",
      "Следующая запись",
      "Неявки",
    ]);
  });

  it("renders initials, name, phone and phone for named clients", () => {
    render(<ClientsTable clients={[makeClient()]} selectedId={null} onSelect={() => {}}
        today="2026-11-16"
        year={2026} />);

    const row = screen.getAllByRole("row")[1]!;
    expect(within(row).getByText("АС")).toBeTruthy();
    expect(within(row).getByText("Айгуль Сапарова")).toBeTruthy();
    expect(within(row).getByText("+77012345678")).toBeTruthy();
    expect(within(row).queryByText("12 окт. 2025 г.")).toBeNull();
  });

  it("shows the phone once and renders no initials when name is missing", () => {
    render(
      <ClientsTable
        clients={[
          makeClient({ id: "c-null", name: null, phone: "+77025550134" }),
          makeClient({ id: "c-blank", name: "   ", phone: "+77078801290" }),
        ]}
        selectedId={null}
        onSelect={() => {}}
        today="2026-11-16"
        year={2026}
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
        selectedId={null}
        onSelect={() => {}}
        today="2026-11-16"
        year={2026}
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
    render(
      <ClientsTable
        clients={[makeClient()]}
        selectedId={null}
        onSelect={() => {}}
        today="2026-11-16"
        year={2026}
        tableRef={tableRef}
      />,
    );

    const table = screen.getByRole("table", { name: "Клиенты" });
    expect(tableRef.current).not.toBe(table);
    expect(tableRef.current?.contains(table)).toBe(true);
    expect(tableRef.current?.classList.contains("overflow-x-auto")).toBe(false);
    expect(tableRef.current?.classList.contains("overflow-hidden")).toBe(true);

    tableRef.current?.focus();
    expect(document.activeElement).toBe(tableRef.current);
  });

  it("renders a button with client name in each row and calls onSelect with the client id", () => {
    const onSelect = vi.fn();
    render(
      <ClientsTable
        clients={[
          makeClient({ id: "c1", name: "Айгуль Сапарова" }),
          makeClient({ id: "c2", name: null, phone: "+77025550134" }),
        ]}
        selectedId={null}
        onSelect={onSelect}
        today="2026-11-16"
        year={2026}
      />,
    );

    const rows = screen.getAllByRole("row").slice(1);
    const firstButton = within(rows[0]!).getByRole("button", {
      name: /Айгуль Сапарова/,
    });
    expect(within(rows[1]!).getByRole("button", { name: "+77025550134" })).toBeTruthy();

    fireEvent.click(firstButton);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("c1");
  });

  it("marks only the selected row with bg-primary-faint and aria-current", () => {
    render(
      <ClientsTable
        clients={[
          makeClient({ id: "c1", name: "Айгуль Сапарова" }),
          makeClient({ id: "c2", name: "Ержан Бекенов", phone: "+77025550134" }),
        ]}
        selectedId="c1"
        onSelect={() => {}}
        today="2026-11-16"
        year={2026}
      />,
    );

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]!.classList.contains("bg-primary-faint")).toBe(true);
    expect(rows[1]!.classList.contains("bg-primary-faint")).toBe(false);

    const firstButton = within(rows[0]!).getByRole("button");
    const secondButton = within(rows[1]!).getByRole("button");
    expect(firstButton.getAttribute("aria-current")).toBe("true");
    expect(secondButton.getAttribute("aria-current")).toBeNull();
  });

  it("renders visits, last visit, next appointment and no-shows", () => {
    render(
      <ClientsTable
        clients={[
          makeClient(
            {},
            {
              visits: 6,
              lastVisitAt: "2026-10-12T10:00:00+05:00",
              nextAppointmentAt: "2026-11-16T10:00:00+05:00",
              noShows: 0,
            },
          ),
        ]}
        selectedId={null}
        onSelect={() => {}}
        today="2026-11-16"
        year={2026}
      />,
    );

    const row = screen.getAllByRole("row")[1]!;
    expect(within(row).getByText("6")).toBeTruthy();
    expect(within(row).getByText("12 окт.")).toBeTruthy();
    expect(within(row).getByText("сегодня, 10:00")).toBeTruthy();
    expect(within(row).getByText("0").classList.contains("text-muted")).toBe(true);
  });

  it("colours no-shows, shows the weekday for later days and a dash for missing dates", () => {
    render(
      <ClientsTable
        clients={[
          makeClient(
            { id: "c1" },
            { noShows: 2, lastVisitAt: "2025-03-05T10:00:00+05:00", nextAppointmentAt: "2026-11-02T10:00:00+05:00" },
          ),
          makeClient({ id: "c2" }),
        ]}
        selectedId={null}
        onSelect={() => {}}
        today="2026-11-16"
        year={2026}
      />,
    );

    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]!).getByText("2").classList.contains("text-accent-strong")).toBe(true);
    expect(within(rows[0]!).getByText("5 мар. 2025 г.")).toBeTruthy();
    expect(within(rows[0]!).getByText("пн, 2 нояб.")).toBeTruthy();
    expect(within(rows[1]!).getAllByText("—")).toHaveLength(2);
  });
});
