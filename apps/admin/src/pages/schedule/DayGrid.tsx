import { ChevronLeft, ChevronRight } from "lucide-react";

import { icon } from "@/components/icon";
import {
  type DaySchedule,
  dayTitle,
  gridHours,
  minutesOfDay,
  nowMark,
  rowClass,
  spanClass,
  spanText,
} from "@/lib/data/calendar";
import type { Appointment, TimeOffPeriod } from "@/lib/data/schedule";
import { formatTime } from "@/lib/format";

import { CalendarDnd } from "./CalendarDnd";
import { DayColumn, HourColumn } from "./DayColumn";

const NAV_BUTTON = "flex size-target items-center justify-center rounded-8 text-ink";

const NOW_ALIGN = {
  start: "self-start",
  center: "self-center",
  end: "self-end",
} as const;

type Props = {
  day: string;
  today: string;
  now: Date;
  timeZone: string;
  schedule: DaySchedule;
  timeOff: readonly TimeOffPeriod[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (delta: -1 | 1) => void;
  onReschedule?: (appointment: Appointment, start: Date) => void;
};

export function DayGrid({ day, today, now, timeZone, schedule, timeOff, selectedId, onSelect, onMove, onReschedule }: Props) {
  const range = gridHours([day], () => schedule.windows, schedule.list, timeZone);
  const hours = Array.from({ length: range.end - range.start }, (_, i) => range.start + i);
  const mark = day === today ? nowMark(minutesOfDay(now, day, timeZone), range) : null;

  return (
    <section aria-label="День" className="overflow-hidden rounded-16 border border-line bg-surface">
      <div className="flex items-center gap-8 border-b border-line px-16 py-12">
        <button type="button" aria-label="Предыдущий день" onClick={() => onMove(-1)} className={NAV_BUTTON}>
          <ChevronLeft size={icon.nav} strokeWidth={icon.stroke} aria-hidden="true" />
        </button>
        <h2 className="text-subtitle">{dayTitle(day)}</h2>
        <button type="button" aria-label="Следующий день" onClick={() => onMove(1)} className={NAV_BUTTON}>
          <ChevronRight size={icon.nav} strokeWidth={icon.stroke} aria-hidden="true" />
        </button>
        {schedule.off && <span className="text-secondary text-muted">выходной</span>}
        {day === today && (
          <span className="ml-auto shrink-0 whitespace-nowrap rounded-6 bg-primary-soft px-8 py-4 text-label text-primary-strong">
            Сегодня
          </span>
        )}
      </div>
      <CalendarDnd days={[day]} range={range} timeZone={timeZone} appointments={schedule.list} vertical onDrop={onReschedule}>
        <div className="flex">
          <HourColumn hours={hours} layout="day" />
          <DayColumn
            day={day}
            windows={schedule.windows}
            off={schedule.off}
            list={schedule.list}
            range={range}
            hours={hours}
            timeZone={timeZone}
            timeOff={timeOff}
            selectedId={selectedId}
            onSelect={onSelect}
            layout="day"
            draggable={onReschedule !== undefined}
          >
          {schedule.free?.map((span) => {
            const rows = spanClass(span.start, span.end, day, range, timeZone);
            return (
              rows && (
                <div
                  key={span.start.getTime()}
                  className={`pointer-events-none col-start-1 mx-12 my-2 flex items-center overflow-hidden rounded-10 border-appointment border-dashed border-border-dashed pl-14 pr-12 text-secondary font-semibold text-muted ${rows}`}
                >
                  <span className="truncate">{`Свободно ${spanText(span, timeZone)} · бот предлагает это время`}</span>
                </div>
              )
            );
          })}
          {mark && (
            <div
              role="img"
              aria-label={`Сейчас ${formatTime(now, timeZone)}`}
              className={`pointer-events-none col-start-1 flex h-2 items-center bg-accent ${rowClass({ start: mark.start, span: 1 })} ${NOW_ALIGN[mark.align]}`}
            >
              <span className="-ml-6 size-12 shrink-0 rounded-full bg-accent" />
            </div>
          )}
        </DayColumn>
        </div>
      </CalendarDnd>
    </section>
  );
}
