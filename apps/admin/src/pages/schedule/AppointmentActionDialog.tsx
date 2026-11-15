import { useRef } from "react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  ACTION_DIALOG,
  type AppointmentAction,
  actionErrorKind,
  actionErrorText,
  actionText,
} from "@/lib/data/appointmentActions";
import { useAppointmentAction } from "@/lib/data/hooks";
import type { Appointment } from "@/lib/data/schedule";

type AppointmentActionDialogProps = {
  appointment: Appointment;
  kind: AppointmentAction;
  timeZone: string;
  onClose: () => void;
  onDone: (id: string) => void;
  returnFocus?: () => HTMLElement | null;
};

/** Confirmation dialog for cancelling an appointment or marking it as no-show. */
export function AppointmentActionDialog({
  appointment,
  kind,
  timeZone,
  onClose,
  onDone,
  returnFocus,
}: AppointmentActionDialogProps) {
  const done = useRef(false);
  const mutation = useAppointmentAction();
  const copy = ACTION_DIALOG[kind];
  const error = mutation.error
    ? actionErrorText(actionErrorKind(mutation.error))
    : undefined;

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={copy.title}
      text={actionText(kind, appointment, timeZone)}
      confirmLabel={copy.confirm}
      cancelLabel={copy.back}
      confirmVariant={kind === "cancel" ? "destructive-solid" : "primary"}
      busy={mutation.isPending}
      error={error}
      onConfirm={() =>
        mutation.mutate(
          { id: appointment.id, action: kind },
          {
            onSuccess: () => {
              done.current = true;
              onDone(appointment.id);
            },
          },
        )
      }
      onCloseAutoFocus={(event) => {
        if (!done.current) return;
        const target = returnFocus?.();
        if (!target) return;
        event.preventDefault();
        target.focus();
      }}
    />
  );
}
