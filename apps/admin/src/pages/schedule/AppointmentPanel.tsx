import { SOURCE_TEXT, STATUS_TEXT, serviceText, whenText } from "@/lib/data/calendar";
import type { Appointment } from "@/lib/data/schedule";

type Props = { appointment: Appointment | null; timeZone: string; empty: boolean };

const LEGEND = [
  { label: "Записал бот", color: "bg-primary-soft border-primary-mid" },
  { label: "Вручную", color: "bg-manual-soft border-manual-border" },
  { label: "Отменена", color: "bg-neutral-soft border-border-dashed" },
];

export function AppointmentPanel({ appointment, timeZone, empty }: Props) {
  const rows = appointment && [
    ["Когда", whenText(appointment, timeZone)],
    ["Услуга", serviceText(appointment)],
    ["Источник", SOURCE_TEXT[appointment.source]],
    ["Статус", STATUS_TEXT[appointment.status]],
  ];
  return (
    <aside aria-label="Выбранная запись" className="flex basis-panel-basis grow flex-col gap-14 rounded-16 border border-line bg-surface p-20">
      {empty ? (
        <>
          <h2 className="text-subtitle text-ink">На этой неделе записей нет</h2>
          <p className="text-body text-muted">Новые записи от бота и из приложения появятся здесь сами.</p>
        </>
      ) : (
        <>
          <span className="text-secondary font-bold text-muted">Выбранная запись</span>
          {appointment && rows ? (
            <>
              <div className="flex flex-col gap-4">
                <strong className="text-title-s">{appointment.clientName}</strong>
                <span className="text-body text-muted">{appointment.clientPhone}</span>
              </div>
              <dl className="flex flex-col gap-8 text-body">
                {rows.map(([term, value]) => (
                  <div key={term} className="flex justify-between gap-8">
                    <dt className="text-muted">{term}</dt>
                    <dd className={`font-bold ${term === "Статус" && appointment.status === "confirmed" ? "text-primary-strong" : ""}`}>{value}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <p className="text-body text-muted">Нажмите на запись в календаре — здесь появятся подробности.</p>
          )}
          <ul className="flex flex-col gap-6 text-label font-normal text-muted">
            {LEGEND.map(({ label, color }) => (
              <li key={label} className="flex items-center gap-8">
                <span aria-hidden="true" className={`size-12 rounded-4 border-appointment ${color}`} />
                {label}
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}
