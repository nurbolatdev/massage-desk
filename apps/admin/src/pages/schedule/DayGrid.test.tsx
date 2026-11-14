// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { daySchedule } from "@/lib/data/calendar";
import type { Appointment, TimeOffPeriod, WorkingBlock } from "@/lib/data/schedule";

import { DayGrid } from "./DayGrid";

afterEach(cleanup);

const TZ = "Asia/Tashkent";
const DAY = "2026-11-02";
const NOW = new Date("2026-11-02T09:35:00+05:00");

const blocks: WorkingBlock[] = [1, 2, 3, 4, 5, 6].flatMap((weekday) => [
  { weekday, start: "09:00", end: "13:00" },
  { weekday, start: "14:00", end: "19:00" },
]);

function appt(
  id: string,
  clientName: string,
  serviceName: string,
  from: string,
  to: string,
  source: Appointment["source"] = "bot",
): Appointment {
  return {
    id,
    clientId: `c-${id}`,
    clientName,
    clientPhone: "+77012345678",
    serviceId: `s-${id}`,
    serviceName,
    start: new Date(`${DAY}T${from}:00+05:00`),
    end: new Date(`${DAY}T${to}:00+05:00`),
    status: "confirmed",
    source,
  };
}

const list: Appointment[] = [
  appt("a1", "Айгуль Сапарова", "Массаж спины", "10:00", "11:00"),
  appt("a2", "Ержан Бекенов", "Общий массаж", "11:30", "13:00"),
  appt("a3", "Светлана Петрова", "Шейно-воротниковая", "14:30", "15:00"),
  appt("a4", "Марат Каримов", "Массаж спины", "16:00", "17:00", "manual"),
  appt("a5", "Дильноза Рахимова", "Общий массаж", "17:30", "19:00"),
];

type SetupOptions = {
  day?: string;
  today?: string;
  workingBlocks?: WorkingBlock[] | undefined;
  appointments?: Appointment[];
  timeOff?: TimeOffPeriod[];
  selectedId?: string | null;
};

function setup(options: SetupOptions = {}) {
  const day = options.day ?? DAY;
  const today = options.today ?? DAY;
  const workingBlocks = "workingBlocks" in options ? options.workingBlocks : blocks;
  const appointments = options.appointments ?? list;
  const timeOff = options.timeOff ?? [];
  const selectedId = options.selectedId ?? null;
  const onSelect = vi.fn();
  const onMove = vi.fn();
  const schedule = daySchedule({ day, timeZone: TZ, appointments, timeOff, workingBlocks, now: NOW });
  render(
    <DayGrid
      day={day}
      today={today}
      now={NOW}
      timeZone={TZ}
      schedule={schedule}
      timeOff={timeOff}
      selectedId={selectedId}
      onSelect={onSelect}
      onMove={onMove}
    />,
  );
  return { onSelect, onMove };
}

describe("DayGrid", () => {
  it("shows the day title, today chip, and the now line", () => {
    setup();
    expect(screen.getByRole("region", { name: "День" })).toBeTruthy();
    expect(screen.getByText("Понедельник, 2 ноября")).toBeTruthy();
    expect(screen.getByText("Сегодня")).toBeTruthy();

    const line = screen.getByRole("img", { name: "Сейчас 9:35" });
    expect(line.className).toContain("row-start-3");
    expect(line.className).toContain("self-center");
  });

  it("shows breaks and free spans above the threshold", () => {
    setup();
    expect(screen.getByText("Перерыв 13:00–14:00")).toBeTruthy();
    expect(screen.getByText("Свободно 15:00–16:00 · бот предлагает это время")).toBeTruthy();
    expect(screen.getByText("Свободно 14:00–14:30 · бот предлагает это время")).toBeTruthy();
    expect(screen.queryByText(/Свободно 9:45–10:00/)).toBeNull();
  });

  it("places appointment blocks and shows details only for blocks >= 60 min", () => {
    setup();
    const block = screen.getByRole("button", { name: "Айгуль Сапарова, 10:00–11:00, Массаж спины" });
    expect(block.className).toContain("row-start-5");
    expect(block.className).toContain("row-span-4");
    expect(screen.getByText("Массаж спины · 60 мин · бот")).toBeTruthy();
    expect(screen.getByText("Массаж спины · 60 мин · вручную")).toBeTruthy();
    expect(screen.queryByText(/Шейно-воротниковая/)).toBeNull();
  });

  it("handles block selection and day navigation", () => {
    const { onSelect, onMove } = setup({ selectedId: "a4" });
    const selected = screen.getByRole("button", { name: /Марат Каримов/ });
    expect(selected.getAttribute("aria-pressed")).toBe("true");
    expect(selected.classList.contains("bg-primary")).toBe(true);
    expect(screen.getByRole("button", { name: /Айгуль Сапарова/ }).classList.contains("bg-primary")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: /Айгуль Сапарова/ }));
    expect(onSelect).toHaveBeenCalledWith("a1");

    fireEvent.click(screen.getByRole("button", { name: "Предыдущий день" }));
    expect(onMove).toHaveBeenCalledWith(-1);

    fireEvent.click(screen.getByRole("button", { name: "Следующий день" }));
    expect(onMove).toHaveBeenCalledWith(1);
  });

  it("hides the today chip and now line on another day", () => {
    setup({ today: "2026-11-03" });
    expect(screen.queryByText("Сегодня")).toBeNull();
    expect(screen.queryByRole("img", { name: /Сейчас/ })).toBeNull();
  });

  it("shows day off without free spans on Sunday", () => {
    setup({ day: "2026-11-08", appointments: [] });
    expect(screen.getByText("Воскресенье, 8 ноября")).toBeTruthy();
    expect(screen.getByText("выходной")).toBeTruthy();
    expect(screen.queryByText(/Свободно/)).toBeNull();
  });

  it("draws appointments when working hours are unknown", () => {
    setup({ workingBlocks: undefined });
    expect(screen.queryByText(/Перерыв/)).toBeNull();
    expect(screen.queryByText(/Свободно/)).toBeNull();
    expect(screen.getByRole("button", { name: /Айгуль Сапарова/ })).toBeTruthy();
  });

  it("hides a cancelled appointment in a free span while keeping one outside free spans", () => {
    const cancelledFree: Appointment = { ...appt("c1", "Олег Ким", "Массаж спины", "15:00", "16:00"), status: "cancelled" };
    const cancelledPast: Appointment = { ...appt("c2", "Анна Иванова", "Массаж спины", "09:00", "09:30"), status: "cancelled" };
    setup({ appointments: [...list, cancelledFree, cancelledPast] });
    expect(screen.getByText("Свободно 15:00–16:00 · бот предлагает это время")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Олег Ким/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Анна Иванова.*, отменена$/ })).toBeTruthy();
  });

  it("shows closed time for partial time off without a free block on that span", () => {
    const closed: TimeOffPeriod = {
      id: "t1",
      start: new Date(`${DAY}T15:00:00+05:00`),
      end: new Date(`${DAY}T16:00:00+05:00`),
    };
    setup({ timeOff: [closed] });
    expect(screen.getByText("Запись закрыта")).toBeTruthy();
    expect(screen.queryByText(/Свободно 15:00–16:00/)).toBeNull();
    expect(screen.getByText("Свободно 14:00–14:30 · бот предлагает это время")).toBeTruthy();
  });
});
