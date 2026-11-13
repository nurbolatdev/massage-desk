import { isoWeekday, localDay, workingWindowsOfDay, type WorkingWindow } from "@massage-desk/shared";

import {
  WEEKDAYS_SHORT,
  breaksOf,
  dayNote,
  gridAppointments,
  hourRange,
  isDayOff,
  minutesOfDay,
  rowClass,
  rowsOf,
} from "@/lib/data/calendar";
import type { Appointment, TimeOffPeriod, WorkingBlock } from "@/lib/data/schedule";
import { formatTime } from "@/lib/format";

type Props = {
  days: readonly string[];
  today: string;
  timeZone: string;
  appointments: Appointment[];
  timeOff: TimeOffPeriod[];
  workingBlocks: WorkingBlock[] | undefined;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

const BLOCK_COLORS = {
  bot: "bg-primary-soft border-primary-mid text-primary-strong",
  manual: "bg-manual-soft border-manual-border text-accent-strong",
  cancelled: "bg-neutral-soft border-border-dashed text-muted",
  selected: "bg-primary border-stone-dark text-surface",
};

export function WeekGrid({ days, today, timeZone, appointments, timeOff, workingBlocks, selectedId, onSelect }: Props) {
  const windowsOf = (day: string): WorkingWindow[] | undefined =>
    workingBlocks && workingWindowsOfDay(workingBlocks, day, timeZone);
  const shown = gridAppointments(appointments);
  const spans = [
    ...days.flatMap((day) => (windowsOf(day) ?? []).map((w) => ({ start: minutesOfDay(w.start, day, timeZone), end: minutesOfDay(w.end, day, timeZone) }))),
    ...shown.map((a) => {
      const day = localDay(a.start, timeZone);
      return { start: minutesOfDay(a.start, day, timeZone), end: minutesOfDay(a.end, day, timeZone) };
    }),
  ];
  const range = hourRange(spans);
  const hours = Array.from({ length: range.end - range.start }, (_, i) => range.start + i);
  const place = (from: Date, to: Date, day: string): string | null => {
    const rows = rowsOf(minutesOfDay(from, day, timeZone), minutesOfDay(to, day, timeZone), range);
    return rows && rowClass(rows);
  };

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
        <div className="flex">
          <div className="rows-slot-week grid w-56 shrink-0">
            {hours.map((h) => (
              <span key={h} className="row-span-4 border-t border-divider pr-8 pt-2 text-right text-label font-normal text-muted">
                {h}:00
              </span>
            ))}
          </div>
          <div className="grid grow grid-cols-7">
            {columns.map(({ day, windows, off, list }) => (
              <div key={day} className={`rows-slot-week grid grid-cols-1 border-l border-line ${off ? "bg-segment-bg" : ""}`}>
                {hours.map((h, i) => (
                  <div key={h} className={`col-start-1 border-t border-divider ${rowClass({ start: i * 4 + 1, span: 4 })}`} />
                ))}
                {!off &&
                  breaksOf(windows ?? []).map((gap) => {
                    const rows = place(gap.start, gap.end, day);
                    return (
                      rows && (
                        <div key={gap.start.getTime()} className={`hatch col-start-1 flex items-center justify-center text-label font-semibold text-neutral-fg ${rows}`}>
                          Перерыв
                        </div>
                      )
                    );
                  })}
                {!off &&
                  timeOff
                    .filter((p) => minutesOfDay(p.start, day, timeZone) < minutesOfDay(p.end, day, timeZone))
                    .map((p) => {
                      const rows = place(p.start, p.end, day);
                      return (
                        rows && (
                          <div key={p.id} className={`col-start-1 flex items-center justify-center bg-segment-bg text-label font-semibold text-neutral-fg ${rows}`}>
                            Запись закрыта
                          </div>
                        )
                      );
                    })}
                {list.map((a) => {
                  const minutes = Math.round((a.end.getTime() - a.start.getTime()) / 60000);
                  const time = `${formatTime(a.start, timeZone)}–${formatTime(a.end, timeZone)}`;
                  const selected = a.id === selectedId;
                  const rows = place(a.start, a.end, day);
                  if (!rows) return null;
                  const color = selected ? BLOCK_COLORS.selected : a.status === "cancelled" ? BLOCK_COLORS.cancelled : BLOCK_COLORS[a.source];
                  return (
                    <button
                      key={a.id}
                      type="button"
                      aria-pressed={selected}
                      aria-label={`${a.clientName}, ${time}, ${a.serviceName}${a.status === "cancelled" ? ", отменена" : ""}`}
                      onClick={() => onSelect(a.id)}
                      className={`col-start-1 mx-4 my-2 overflow-hidden rounded-8 border-appointment px-6 py-4 text-left ${color} ${rows}`}
                    >
                      {minutes < 60 ? (
                        <span className="block truncate text-label">{`${formatTime(a.start, timeZone)} ${a.clientName}`}</span>
                      ) : (
                        <>
                          <span className="block text-label">{time}</span>
                          <span className="block truncate text-secondary font-bold">{a.clientName}</span>
                          {minutes > 60 && <span className="block truncate text-label font-normal">{a.serviceName}</span>}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
