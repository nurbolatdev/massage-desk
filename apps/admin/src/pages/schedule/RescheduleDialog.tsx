import { useId, useRef } from "react";
import { ChevronRight } from "lucide-react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { icon } from "@/components/icon";
import { useRescheduleAppointment } from "@/lib/data/hooks";
import {
  RESCHEDULE_BACK,
  RESCHEDULE_CONFIRM,
  RESCHEDULE_PICK_AGAIN,
  RESCHEDULE_TITLE,
  pickedText,
  rescheduleErrorKind,
  rescheduleErrorText,
  rescheduleText,
  slotLines,
} from "@/lib/data/reschedule";
import type { Appointment } from "@/lib/data/schedule";

type RescheduleDialogProps = {
  appointment: Appointment;
  start: Date;
  timeZone: string;
  via?: "drag" | "panel";
  returnFocus?: () => HTMLElement | null;
  onClose: () => void;
  onDone: (id: string) => void;
};

/** Confirmation dialog showing old and new times and server reschedule errors. */
export function RescheduleDialog({
  appointment,
  start,
  timeZone,
  via = "drag",
  returnFocus,
  onClose,
  onDone,
}: RescheduleDialogProps) {
  const slotsId = useId();
  const done = useRef(false);
  const end = new Date(start.getTime() + (appointment.end.getTime() - appointment.start.getTime()));
  const before = slotLines(appointment.start, appointment.end, timeZone);
  const after = slotLines(start, end, timeZone);
  const mutation = useRescheduleAppointment();
  const error = mutation.error
    ? rescheduleErrorText(rescheduleErrorKind(mutation.error), start, timeZone)
    : undefined;

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={RESCHEDULE_TITLE}
      text={via === "panel" ? pickedText(appointment.clientName) : rescheduleText(appointment.clientName)}
      confirmLabel={RESCHEDULE_CONFIRM}
      cancelLabel={via === "panel" ? RESCHEDULE_PICK_AGAIN : RESCHEDULE_BACK}
      busy={mutation.isPending}
      error={error}
      describedBy={slotsId}
      onConfirm={() =>
        mutation.mutate(
          { id: appointment.id, start },
          {
            onSuccess: () => {
              done.current = true;
              onDone(appointment.id);
            },
          },
        )
      }
      onCloseAutoFocus={(event) => {
        const target = done.current ? returnFocus?.() : null;
        if (!target) return;
        event.preventDefault();
        target.focus();
      }}
    >
      <div id={slotsId} className="flex items-center gap-12">
        <div className="min-w-0 flex-1 rounded-12 bg-neutral-soft px-12 py-10 text-body font-bold text-muted line-through">
          <span className="sr-only">Было: </span>
          <span className="block">{before.day}</span>
          <span className="block">{before.time}</span>
        </div>
        <ChevronRight
          size={icon.button}
          strokeWidth={icon.stroke}
          className="shrink-0 text-muted"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1 rounded-12 bg-primary-soft px-12 py-10 text-body font-bold text-primary-strong">
          <span className="sr-only">Станет: </span>
          <span className="block">{after.day}</span>
          <span className="block">{after.time}</span>
        </div>
      </div>
    </ConfirmDialog>
  );
}
