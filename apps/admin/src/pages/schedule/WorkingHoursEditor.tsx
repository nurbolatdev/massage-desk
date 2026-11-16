import { useId, useRef, useState } from "react";
import { CircleAlert, RefreshCw } from "lucide-react";

import { icon } from "@/components/icon";
import { PageSkeleton } from "@/components/PageSkeleton";
import { StateCard } from "@/components/StateCard";
import { Button } from "@/components/ui/button";
import { ApiError, type AppointmentConflict } from "@/lib/api/errors";
import { loadErrorText } from "@/lib/data/calendar";
import { useSaveWorkingHours, useSettings, useWorkingHours } from "@/lib/data/hooks";
import type { WorkingBlock } from "@/lib/data/schedule";
import * as wh from "@/lib/data/workingHours";
import { useOnline } from "@/lib/useOnline";

import { WorkingHoursConflictDialog } from "./WorkingHoursConflictDialog";
import { WorkingHoursDay } from "./WorkingHoursDay";

const DAYS = [0, 1, 2, 3, 4, 5, 6] as const;

function HoursForm({ saved, timeZone }: { saved: readonly WorkingBlock[]; timeZone: string }) {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const hintId = `${baseId}-hint`;
  const titleRef = useRef<HTMLHeadingElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);

  const [draft, setDraft] = useState<wh.WeekDraft>(() => wh.toDraft(saved));
  const [conflicts, setConflicts] = useState<AppointmentConflict[] | null>(null);
  const [done, setDone] = useState(false);

  const online = useOnline();
  const save = useSaveWorkingHours();

  const edit = (update: (current: wh.WeekDraft) => wh.WeekDraft) => {
    setDraft(update);
    setDone(false);
  };

  const dirty = !wh.sameWeek(draft, saved);
  const saveDisabled = !dirty || !wh.canSave(draft) || !online || save.isPending;

  const submit = (force: boolean) => {
    save.mutate(
      { blocks: wh.toBlocks(draft), force },
      {
        onSuccess: (week) => {
          setDraft(wh.toDraft(week.blocks));
          setConflicts(null);
          setDone(true);
        },
        onError: (error) => {
          if (!force && error instanceof ApiError && wh.saveErrorKind(error) === "conflict") {
            setConflicts(error.conflicts ?? []);
          }
        },
      },
    );
  };

  const kind = save.error ? wh.saveErrorKind(save.error) : null;
  const errorText = kind && kind !== "conflict" ? wh.saveErrorText(kind, save.error) : undefined;

  return (
    <section
      aria-labelledby={titleId}
      className="flex max-w-content flex-col gap-14 rounded-16 border border-line bg-surface p-20"
    >
      <h2 id={titleId} ref={titleRef} tabIndex={-1} className="text-subtitle text-ink">
        {wh.HOURS_TITLE}
      </h2>
      <p className="text-body text-muted">{wh.HOURS_INTRO}</p>
      <div>
        {DAYS.map((day) => (
          <WorkingHoursDay key={day} day={day} ranges={draft[day] ?? []} disabled={save.isPending} onChange={edit} />
        ))}
      </div>
      <div className="flex flex-col gap-8">
        <div className="flex flex-wrap items-center gap-12">
          <Button
            ref={saveRef}
            type="button"
            disabled={saveDisabled}
            aria-describedby={online ? undefined : hintId}
            onClick={() => submit(false)}
          >
            {wh.SAVE_LABEL}
          </Button>
          {!online && <p id={hintId} className="text-secondary text-muted">{wh.SAVE_OFFLINE_HINT}</p>}
        </div>
        {!conflicts && errorText && <p role="alert" className="text-secondary text-danger">{errorText}</p>}
        <div role="status" aria-live="polite">{done && <p className="text-body text-muted">{wh.SAVED_TEXT}</p>}</div>
      </div>
      {conflicts && (
        <WorkingHoursConflictDialog
          conflicts={conflicts}
          timeZone={timeZone}
          busy={save.isPending}
          error={errorText}
          onConfirm={() => submit(true)}
          onClose={() => {
            setConflicts(null);
            save.reset();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (saveRef.current && !saveRef.current.disabled) {
              saveRef.current.focus();
            } else {
              titleRef.current?.focus();
            }
          }}
        />
      )}
    </section>
  );
}

/** Weekly working hours editor: loading/error states, 7 day rows, validation, and conflict confirmation. */
export function WorkingHoursEditor() {
  const hours = useWorkingHours();
  const settings = useSettings();

  if (!hours.data || !settings.data) {
    const error = hours.error ?? settings.error;
    if (error) {
      return (
        <StateCard
          icon={CircleAlert}
          title={wh.HOURS_LOAD_FAILED}
          text={loadErrorText(error)}
          action={
            <Button
              variant="secondary"
              onClick={() => {
                void hours.refetch();
                void settings.refetch();
              }}
            >
              <RefreshCw size={icon.button} strokeWidth={icon.stroke} aria-hidden="true" />
              Повторить
            </Button>
          }
        />
      );
    }
    return <PageSkeleton />;
  }

  return <HoursForm saved={hours.data.blocks} timeZone={settings.data.timeZone} />;
}
