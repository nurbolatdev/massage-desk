// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { weekDays } from "@massage-desk/shared";

import { DRAG_INSTRUCTIONS } from "@/lib/data/reschedule";
import type { Appointment } from "@/lib/data/schedule";
import { WeekGrid } from "./WeekGrid";

afterEach(cleanup);

const tz = "Asia/Tashkent";
const days = weekDays("2026-11-02");
const blocks = [1, 2, 3, 4, 5, 6].flatMap((weekday) => [
  { weekday, start: "09:00", end: "13:00" },
  { weekday, start: "14:00", end: "19:00" },
]);

function appt(id: string, name: string, day: string, from: string, to: string, status: Appointment["status"] = "confirmed"): Appointment {
  return {
    id,
    clientId: `c-${id}`,
    clientName: name,
    clientPhone: "+77012345678",
    serviceId: "s1",
    serviceName: "Массаж спины",
    start: new Date(`${day}T${from}:00+05:00`),
    end: new Date(`${day}T${to}:00+05:00`),
    status,
    source: "bot",
  };
}

const list = [
  appt("a1", "Айгуль Сапарова", "2026-11-02", "10:00", "11:00"),
  appt("a2", "Ержан Бекенов", "2026-11-02", "11:30", "13:00"),
  appt("a3", "Олег Ким", "2026-11-03", "10:00", "11:00"),
  appt("a4", "Марат Каримов", "2026-11-03", "10:00", "11:00", "cancelled"),
  appt("a5", "Светлана", "2026-11-03", "15:00", "16:00", "cancelled"),
];

function setup(overrides: Partial<Parameters<typeof WeekGrid>[0]> = {}) {
  const onSelect = vi.fn();
  render(
    <WeekGrid
      days={days}
      today="2026-11-03"
      timeZone={tz}
      appointments={list}
      timeOff={[]}
      workingBlocks={blocks}
      selectedId={null}
      onSelect={onSelect}
      {...overrides}
    />,
  );
  return onSelect;
}

describe("WeekGrid", () => {
  it("shows the day headers with notes", () => {
    setup();
    expect(screen.getByText("Пн")).toBeTruthy();
    expect(screen.getByText("2 записи")).toBeTruthy();
    expect(screen.getByText("выходной")).toBeTruthy();
    expect(screen.getAllByText("свободно").length).toBe(4);
  });

  it("places a block on the grid rows", () => {
    setup();
    const block = screen.getByRole("button", { name: "Айгуль Сапарова, 10:00–11:00, Массаж спины" });
    expect(block.className).toContain("row-start-5");
    expect(block.className).toContain("row-span-4");
  });

  it("draws breaks and hides a cancelled block that overlaps an active one", () => {
    setup();
    expect(screen.getAllByText("Перерыв").length).toBe(6);
    expect(screen.queryByRole("button", { name: /Марат Каримов/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Светлана.*, отменена$/ })).toBeTruthy();
  });

  it("selects a block on click", () => {
    const onSelect = setup({ selectedId: "a3" });
    fireEvent.click(screen.getByRole("button", { name: /Айгуль Сапарова/ }));
    expect(onSelect).toHaveBeenCalledWith("a1");
    expect(screen.getByRole("button", { name: /Олег Ким/ }).getAttribute("aria-pressed")).toBe("true");
  });

  it("draws the grid without working hours", () => {
    setup({ workingBlocks: undefined });
    expect(screen.queryByText("Перерыв")).toBeNull();
    expect(screen.queryByText("выходной")).toBeNull();
    expect(screen.getByRole("region", { name: "Неделя" })).toBeTruthy();
  });

  it("does not draw time off outside the visible hours", () => {
    const evening = { id: "t1", start: new Date("2026-11-04T19:00:00+05:00"), end: new Date("2026-11-04T22:00:00+05:00") };
    const morning = { id: "t2", start: new Date("2026-11-05T06:00:00+05:00"), end: new Date("2026-11-05T09:00:00+05:00") };
    setup({ timeOff: [evening, morning] });
    expect(screen.queryByText("Запись закрыта")).toBeNull();
  });

  it("draws time off inside the visible hours", () => {
    const midday = { id: "t3", start: new Date("2026-11-04T15:00:00+05:00"), end: new Date("2026-11-04T17:00:00+05:00") };
    setup({ timeOff: [midday] });
    expect(screen.getByText("Запись закрыта")).toBeTruthy();
  });

  it("marks only confirmed blocks as grabbable when onReschedule is provided", () => {
    const done = appt("a6", "Анна Иванова", "2026-11-05", "12:00", "13:00", "done");
    setup({ appointments: [...list, done], onReschedule: vi.fn() });
    expect(screen.getByRole("button", { name: /Айгуль Сапарова/ }).classList.contains("cursor-grab")).toBe(true);
    expect(screen.getByRole("button", { name: /Светлана/ }).classList.contains("cursor-grab")).toBe(false);
    expect(screen.getByRole("button", { name: /Анна Иванова/ }).classList.contains("cursor-grab")).toBe(false);
  });

  it("does not mark blocks as grabbable without onReschedule and still selects on click", () => {
    const done = appt("a6", "Анна Иванова", "2026-11-05", "12:00", "13:00", "done");
    setup({ appointments: [...list, done] });
    expect(screen.getByRole("button", { name: /Айгуль Сапарова/ }).classList.contains("cursor-grab")).toBe(false);
    expect(screen.getByRole("button", { name: /Светлана/ }).classList.contains("cursor-grab")).toBe(false);
    expect(screen.getByRole("button", { name: /Анна Иванова/ }).classList.contains("cursor-grab")).toBe(false);

    cleanup();
    const onSelect = setup({ onReschedule: vi.fn() });
    fireEvent.click(screen.getByRole("button", { name: /Айгуль Сапарова/ }));
    expect(onSelect).toHaveBeenCalledWith("a1");
  });

  it("keeps aria-pressed on selected draggable blocks across appointment updates and sets Russian drag attributes", async () => {
    const done = appt("a6", "Анна Иванова", "2026-11-05", "12:00", "13:00", "done");
    const extra = appt("a7", "Дильноза Рахимова", "2026-11-06", "14:00", "15:00");
    const { rerender } = render(
      <WeekGrid
        days={days}
        today="2026-11-03"
        timeZone={tz}
        appointments={[...list, done]}
        timeOff={[]}
        workingBlocks={blocks}
        selectedId="a1"
        onSelect={vi.fn()}
        onReschedule={vi.fn()}
      />,
    );

    const selected = screen.getByRole("button", { name: /Айгуль Сапарова/ });
    expect(selected.getAttribute("aria-pressed")).toBe("true");
    expect(selected.getAttribute("aria-roledescription")).toBe("запись, можно перенести");
    expect(selected.getAttribute("draggable")).toBeNull();
    const describedById = selected.getAttribute("aria-describedby");
    expect(describedById).toBeTruthy();
    expect(document.getElementById(describedById ?? "")?.textContent).toBe(DRAG_INSTRUCTIONS);

    const cancelled = screen.getByRole("button", { name: /Светлана/ });
    expect(cancelled.getAttribute("aria-roledescription")).toBeNull();
    expect(cancelled.getAttribute("aria-describedby")).toBeNull();
    expect(screen.getByRole("button", { name: /Анна Иванова/ }).getAttribute("aria-roledescription")).toBeNull();

    rerender(
      <WeekGrid
        days={days}
        today="2026-11-03"
        timeZone={tz}
        appointments={[...list, done, extra]}
        timeOff={[]}
        workingBlocks={blocks}
        selectedId="a1"
        onSelect={vi.fn()}
        onReschedule={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Дильноза Рахимова/ })).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: /Айгуль Сапарова/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /Айгуль Сапарова/ }).getAttribute("draggable")).toBeNull();
  });
});
