import { isoWeekday, localDay, workingWindowsOfDay, type WorkingWindow } from "@massage-desk/shared";

import { WEEKDAYS_SHORT, dayNote, gridAppointments, gridHours, isDayOff } from "@/lib/data/calendar";
import type { Appointment, TimeOffPeriod, WorkingBlock } from "@/lib/data/schedule";

import { CalendarDnd } from "./CalendarDnd";
import { DayColumn, HourColumn } from "./DayColumn";

type Props = {
  days: readonly string[];
  today: string;
  timeZone: string;
  appointments: Appointment[];
  timeOff: TimeOffPeriod[];
  workingBlocks: WorkingBlock[] | undefined;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReschedule?: (appointment: Appointment, start: Date) => void;
};

export function WeekGrid({
  days,
  today,
  timeZone,
  appointments,
  timeOff,
  workingBlocks,
  selectedId,
  onSelect,
  onReschedule,
}: Props) {
  const windowsOf = (day: string): WorkingWindow[] | undefined =>
    workingBlocks && workingWindowsOfDay(workingBlocks, day, timeZone);
  const shown = gridAppointments(appointments);
  const range = gridHours(days, windowsOf, shown, timeZone);
  const hours = Array.from({ length: range.end - range.start }, (_, i) => range.start + i);

  const columns = days.map((day) => {
    const windows = windowsOf(day);
    const off = isDayOff(day, windows, timeOff, timeZone);
    const list = shown.filter((a) => localDay(a.start, timeZone) === day);
    return { day, windows, off, list, count: list.filter((a) => a.status !== "cancelled").length };
  });

  return (
    <section aria-label="Неделя" className="overflow-x-auto rounded-16 border border-line bg-surface">
      <div className="min-w-calendar-min">
        <div className="flex border-b border-line">
          <span className="w-56 shrink-0" />
          <div className="grid grow grid-cols-7">
            {columns.map(({ day, off, count }) => (
              <div key={day} className={`flex flex-col gap-2 px-10 py-12 ${day === today ? "bg-primary-faint" : ""}`}>
                <span className="text-secondary text-muted">{WEEKDAYS_SHORT[isoWeekday(day) - 1]}</span>
                <span className={`text-title-s ${day === today ? "text-primary" : ""}`}>{Number(day.slice(8))}</span>
                <span className="text-label font-normal text-muted">{dayNote(count, off)}</span>
              </div>
            ))}
          </div>
        </div>
        <CalendarDnd days={days} range={range} timeZone={timeZone} appointments={shown} onDrop={onReschedule}>
          <div className="flex">
            <HourColumn hours={hours} />
            <div className="grid grow grid-cols-7">
              {columns.map(({ day, windows, off, list }) => (
                <DayColumn
                  key={day}
                  day={day}
                  windows={windows}
                  off={off}
                  list={list}
                  range={range}
                  hours={hours}
                  timeZone={timeZone}
                  timeOff={timeOff}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  draggable={onReschedule !== undefined}
                />
              ))}
            </div>
          </div>
        </CalendarDnd>
      </div>
    </section>
  );
}
