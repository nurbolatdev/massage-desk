import { useId } from "react";
import { CircleAlert } from "lucide-react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { icon } from "@/components/icon";
import type { AppointmentConflict } from "@/lib/api/errors";
import {
  CONFLICT_BACK,
  CONFLICT_CONFIRM,
  CONFLICT_LIST_MAX,
  CONFLICT_TITLE,
  conflictLines,
  conflictMore,
  conflictText,
} from "@/lib/data/workingHours";

const DEFAULT_LIST_LABEL = "Записи вне новых часов";

type WorkingHoursConflictDialogProps = {
  conflicts: readonly AppointmentConflict[];
  timeZone: string;
  busy?: boolean;
  error?: string;
  title?: string;
  text?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  listLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
  onCloseAutoFocus?: (event: Event) => void;
};

/** Confirmation dialog listing confirmed appointments outside the new working hours or the new time zone. */
export function WorkingHoursConflictDialog({
  conflicts,
  timeZone,
  busy = false,
  error,
  title = CONFLICT_TITLE,
  text = conflictText(conflicts.length),
  confirmLabel = CONFLICT_CONFIRM,
  cancelLabel = CONFLICT_BACK,
  listLabel = DEFAULT_LIST_LABEL,
  onConfirm,
  onClose,
  onCloseAutoFocus,
}: WorkingHoursConflictDialogProps) {
  const listId = useId();
  const lines = conflictLines(conflicts, timeZone);
  const visible = lines.slice(0, CONFLICT_LIST_MAX);
  const more = conflictMore(lines.length - visible.length);

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={title}
      text={text}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      busy={busy}
      error={error}
      describedBy={conflicts.length ? listId : undefined}
      onConfirm={onConfirm}
      onCloseAutoFocus={onCloseAutoFocus}
    >
      {conflicts.length ? (
        <div className="flex gap-10 rounded-10 bg-accent-soft px-12 py-10 text-secondary text-accent-strong">
          <CircleAlert
            size={icon.nav}
            strokeWidth={icon.stroke}
            className="shrink-0 text-warning-icon"
            aria-hidden="true"
          />
          <ul id={listId} aria-label={listLabel} className="flex min-w-0 flex-col gap-4">
            {visible.map(({ id, name, when }) => (
              <li key={id}>
                <span className="font-bold">{name}</span> — {when}
              </li>
            ))}
            {more ? <li>{more}</li> : null}
          </ul>
        </div>
      ) : null}
    </ConfirmDialog>
  );
}
