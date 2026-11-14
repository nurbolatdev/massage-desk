import type { ReactNode } from "react";
import type { WorkingWindow } from "@massage-desk/shared";

import { type Span, blockDetail, breaksOf, minutesOfDay, rowClass, spanClass, spanText } from "@/lib/data/calendar";
import type { Appointment, TimeOffPeriod } from "@/lib/data/schedule";
import { formatTime } from "@/lib/format";

type GridLayout = "week" | "day";

const LAYOUT = {
  week: {
    rows: "rows-slot-week",
    column: "border-l border-line",
    breakBox: "justify-center text-label",
    block: "mx-4 my-2 rounded-8 px-6 py-4",
  },
  day: {
    rows: "rows-slot-day",
    column: "min-w-0 grow",
    breakBox: "mx-12 rounded-10 pl-14 text-secondary",
    block: "mx-12 my-2 rounded-10 px-12 py-4",
  },
} as const;

const BLOCK_COLORS = {
  bot: "bg-primary-soft border-primary-mid text-primary-strong",
  manual: "bg-manual-soft border-manual-border text-accent-strong",
  cancelled: "bg-neutral-soft border-border-dashed text-muted",
  selected: "bg-primary border-stone-dark text-surface",
};

export function HourColumn({ hours, layout = "week" }: { hours: readonly number[]; layout?: GridLayout }) {
  return (
    <div className={`${LAYOUT[layout].rows} grid w-56 shrink-0`}>
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
  layout?: GridLayout;
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
  layout = "week",
  children,
}: DayColumnProps) {
  const cfg = LAYOUT[layout];
  return (
    <div className={`${cfg.rows} grid grid-cols-1 ${cfg.column} ${off ? "bg-segment-bg" : ""}`}>
      {hours.map((h, i) => (
        <div key={h} className={`col-start-1 border-t border-divider ${rowClass({ start: i * 4 + 1, span: 4 })}`} />
      ))}
      {!off &&
        breaksOf(windows ?? []).map((gap) => {
          const rows = spanClass(gap.start, gap.end, day, range, timeZone);
          return (
            rows && (
              <div key={gap.start.getTime()} className={`hatch col-start-1 flex items-center font-semibold text-neutral-fg ${cfg.breakBox} ${rows}`}>
                {layout === "day" ? `Перерыв ${spanText(gap, timeZone)}` : "Перерыв"}
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
                <div key={p.id} className={`col-start-1 flex items-center bg-segment-bg font-semibold text-neutral-fg ${cfg.breakBox} ${rows}`}>
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
            className={`col-start-1 overflow-hidden border-appointment text-left ${cfg.block} ${color} ${rows}`}
          >
            {layout === "day" ? (
              <span className="flex items-start gap-16">
                <span className="shrink-0 text-body font-bold tabular-nums">{time}</span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-body font-bold">{a.clientName}</span>
                  {minutes >= 60 && <span className="truncate text-secondary font-normal">{blockDetail(a)}</span>}
                </span>
              </span>
            ) : minutes < 60 ? (
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
