import type { ReactNode } from "react";
import type { WorkingWindow } from "@massage-desk/shared";

import { type Span, breaksOf, minutesOfDay, rowClass, spanClass } from "@/lib/data/calendar";
import type { Appointment, TimeOffPeriod } from "@/lib/data/schedule";
import { formatTime } from "@/lib/format";

const BLOCK_COLORS = {
  bot: "bg-primary-soft border-primary-mid text-primary-strong",
  manual: "bg-manual-soft border-manual-border text-accent-strong",
  cancelled: "bg-neutral-soft border-border-dashed text-muted",
  selected: "bg-primary border-stone-dark text-surface",
};

export function HourColumn({ hours }: { hours: readonly number[] }) {
  return (
    <div className="rows-slot-week grid w-56 shrink-0">
      {hours.map((h) => (
        <span key={h} className="row-span-4 border-t border-divider pr-8 pt-2 text-right text-label font-normal text-muted">
          {h}:00
        </span>
      ))}
    </div>
  );
}

type DayColumnProps = {
  day: string;
  windows: WorkingWindow[] | undefined;
  off: boolean;
  list: readonly Appointment[];
  range: Span;
  hours: readonly number[];
  timeZone: string;
  timeOff: readonly TimeOffPeriod[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  children?: ReactNode;
};

export function DayColumn({
  day,
  windows,
  off,
  list,
  range,
  hours,
  timeZone,
  timeOff,
  selectedId,
  onSelect,
  children,
}: DayColumnProps) {
  return (
    <div className={`rows-slot-week grid grid-cols-1 border-l border-line ${off ? "bg-segment-bg" : ""}`}>
      {hours.map((h, i) => (
        <div key={h} className={`col-start-1 border-t border-divider ${rowClass({ start: i * 4 + 1, span: 4 })}`} />
      ))}
      {!off &&
        breaksOf(windows ?? []).map((gap) => {
          const rows = spanClass(gap.start, gap.end, day, range, timeZone);
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
            const rows = spanClass(p.start, p.end, day, range, timeZone);
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
        const rows = spanClass(a.start, a.end, day, range, timeZone);
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
      {children}
    </div>
  );
}
