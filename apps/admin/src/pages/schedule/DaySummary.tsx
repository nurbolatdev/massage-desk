import { type DaySchedule, dayShortTitle, freeText } from "@/lib/data/calendar";

type Props = {
  day: string;
  timeZone: string;
  schedule: DaySchedule;
};

const ROW = "flex justify-between gap-8 border-b border-divider py-6 text-body";

export function DaySummary({ day, timeZone, schedule }: Props) {
  const freeValue = schedule.off
    ? "выходной"
    : schedule.free !== undefined
      ? freeText(schedule.free, timeZone)
      : null;

  return (
    <aside aria-label="Сводка дня" className="flex flex-col gap-14 rounded-16 border border-line bg-surface p-20">
      <h2 className="text-subtitle text-ink">{dayShortTitle(day)}</h2>
      <dl className="flex flex-col">
        <div className={ROW}>
          <dt className="shrink-0 text-muted">Записей</dt>
          <dd className="text-right font-bold">{schedule.count}</dd>
        </div>
        {freeValue !== null && (
          <div className={ROW}>
            <dt className="shrink-0 text-muted">Свободно</dt>
            <dd className="text-right font-bold">{freeValue}</dd>
          </div>
        )}
      </dl>
    </aside>
  );
}
