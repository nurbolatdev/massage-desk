import type { Ref } from "react";

import { Button } from "@/components/ui/button";
import {
  CANCEL_LABEL,
  NO_SHOW_LABEL,
  panelActions,
  type AppointmentAction,
} from "@/lib/data/appointmentActions";
import { SOURCE_TEXT, STATUS_TEXT, serviceText, whenText } from "@/lib/data/calendar";
import { canReschedule } from "@/lib/data/dropTarget";
import { DRAG_HINT, KEYBOARD_HINT } from "@/lib/data/reschedule";
import type { Appointment } from "@/lib/data/schedule";
import { useOnline } from "@/lib/useOnline";

type Props = {
  appointment: Appointment | null;
  timeZone: string;
  empty: boolean;
  now?: Date;
  onAction?: (kind: AppointmentAction, trigger: HTMLElement) => void;
  nameRef?: Ref<HTMLElement>;
};

const LEGEND = [
  { label: "Записал бот", color: "bg-primary-soft border-primary-mid" },
  { label: "Вручную", color: "bg-manual-soft border-manual-border" },
  { label: "Отменена", color: "bg-neutral-soft border-border-dashed" },
];

export function AppointmentPanel({ appointment, timeZone, empty, now, onAction, nameRef }: Props) {
  const online = useOnline();
  const actions =
    appointment && onAction && now ? { ...panelActions(appointment, now), onAction } : null;
  const rows = appointment && [
    { term: "Когда", value: whenText(appointment, timeZone) },
    { term: "Услуга", value: serviceText(appointment) },
    { term: "Источник", value: SOURCE_TEXT[appointment.source] },
    {
      term: "Статус",
      value: STATUS_TEXT[appointment.status],
      className: appointment.status === "confirmed" ? "text-primary-strong" : "text-muted",
    },
  ];
  return (
    <aside aria-label="Выбранная запись" className="flex flex-col gap-14 rounded-16 border border-line bg-surface p-20">
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
                <strong ref={nameRef} tabIndex={-1} className="text-title-s font-bold">
                  {appointment.clientName}
                </strong>
                <span className="text-body text-muted">{appointment.clientPhone}</span>
              </div>
              <dl className="flex flex-col gap-8 text-body">
                {rows.map(({ term, value, className }) => (
                  <div key={term} className="flex justify-between gap-8">
                    <dt className="text-muted">{term}</dt>
                    <dd className={`font-bold ${className ?? ""}`}>{value}</dd>
                  </div>
                ))}
              </dl>
              {actions && (actions.cancel || actions.noShow) && (
                <div className="flex flex-wrap gap-8">
                  {actions.noShow && (
                    <Button
                      variant="secondary"
                      className="grow"
                      disabled={!online}
                      onClick={(event) => actions.onAction("noShow", event.currentTarget)}
                    >
                      {NO_SHOW_LABEL}
                    </Button>
                  )}
                  {actions.cancel && (
                    <Button
                      variant="destructive"
                      className="grow"
                      disabled={!online}
                      onClick={(event) => actions.onAction("cancel", event.currentTarget)}
                    >
                      {CANCEL_LABEL}
                    </Button>
                  )}
                </div>
              )}
              {canReschedule(appointment) && (
                <div className="flex flex-col gap-6 rounded-12 bg-bg-page p-12 text-secondary font-normal text-text-strong">
                  <p>{DRAG_HINT}</p>
                  <p>{KEYBOARD_HINT}</p>
                </div>
              )}
            </>
          ) : (
            <p className="text-body text-muted">Нажмите на запись в календаре — здесь появятся подробности.</p>
          )}
          <ul className="flex flex-col gap-6 text-secondary font-normal text-muted">
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
