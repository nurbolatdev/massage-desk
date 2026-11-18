import { useId, useRef, useState } from "react";
import { localDay } from "@massage-desk/shared";
import { RefreshCw, WifiOff } from "lucide-react";

import { icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDaySlots } from "@/lib/data/hooks";
import * as rt from "@/lib/data/rescheduleTime";
import type { Appointment } from "@/lib/data/schedule";
import { formatTime } from "@/lib/format";
import { useOnline } from "@/lib/useOnline";

type Props = {
  appointment: Appointment;
  timeZone: string;
  today: string;
  day?: string;
  trigger?: HTMLElement | null;
  onClose: () => void;
  onPick: (start: Date, day: string) => void;
};

function SlotsBody({
  view,
  starts,
  error,
  timeZone,
  onRetry,
  onSelect,
}: {
  view: rt.SlotsView;
  starts: Date[] | undefined;
  error: unknown;
  timeZone: string;
  onRetry: () => void;
  onSelect: (start: Date) => void;
}) {
  if (view === "offline") {
    return (
      <div className="flex items-center gap-10 rounded-10 bg-text-strong px-12 py-10 text-body text-surface">
        <WifiOff size={icon.button} strokeWidth={icon.stroke} aria-hidden="true" className="shrink-0" />
        <span>{rt.TIMES_OFFLINE}</span>
      </div>
    );
  }
  if (view === "error") {
    return (
      <div className="flex flex-col items-start gap-10">
        <div role="alert" className="w-full rounded-10 bg-danger-soft px-12 py-10 text-secondary text-danger-strong">
          <p className="font-bold">{rt.TIMES_FAILED}</p>
          <p className="font-medium">{rt.slotsErrorText(error)}</p>
        </div>
        {rt.slotsRetryable(error) && (
          <Button variant="secondary" onClick={onRetry}>
            <RefreshCw size={icon.button} strokeWidth={icon.stroke} aria-hidden="true" />
            {rt.RETRY_LABEL}
          </Button>
        )}
      </div>
    );
  }
  if (view !== "ready") return null;
  return (
    <div role="group" aria-label={rt.TIMES_LABEL} className="grid grid-cols-4 gap-6">
      {(starts ?? []).map((start) => (
        <button
          key={start.toISOString()}
          type="button"
          onClick={() => onSelect(start)}
          className="h-target rounded-8 border border-border-strong bg-surface text-body font-bold text-ink active:bg-segment-bg"
        >
          {formatTime(start, timeZone)}
        </button>
      ))}
    </div>
  );
}

/** Dialog for choosing a day and a server-computed free time before confirming reschedule. */
export function RescheduleTimeDialog({ appointment, timeZone, today, day, trigger, onClose, onPick }: Props) {
  const dateId = useId();
  const picked = useRef(false);
  const [pick, setPick] = useState(() => rt.dayPick(day ?? localDay(appointment.start, timeZone), today));
  const online = useOnline();
  const query = useDaySlots(appointment.serviceId, rt.pickableDay(pick.day, today) ? pick.day : null);
  const view = rt.slotsView({ day: pick.day, today, online, starts: query.data, error: query.error });
  const statusText = rt.slotsStatusText(view);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        onCloseAutoFocus={(event) => {
          if (picked.current) {
            event.preventDefault();
            return;
          }
          if (!trigger?.isConnected) return;
          event.preventDefault();
          trigger.focus();
        }}
      >
        <div className="flex flex-col gap-14 px-24 pt-20 pb-16">
          <DialogTitle className="pr-40">{rt.PICK_TITLE}</DialogTitle>
          <DialogDescription>{rt.pickerText(appointment, timeZone)}</DialogDescription>
          <div role="group" aria-label="День" className="flex flex-wrap gap-4 rounded-10 bg-segment-bg p-4">
            {rt.DAY_CHOICES.map(([choice, label]) => (
              <button
                key={choice}
                type="button"
                aria-pressed={pick.choice === choice}
                onClick={() => setPick((prev) => ({ choice, day: rt.choiceDay(choice, today, prev.day) }))}
                className={`h-target grow rounded-8 px-14 text-body ${pick.choice === choice ? "bg-surface font-bold" : "font-semibold"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {pick.choice === "other" && (
            <div className="flex flex-col gap-6">
              <Label htmlFor={dateId}>{rt.DATE_LABEL}</Label>
              <Input
                id={dateId}
                type="date"
                min={today}
                value={pick.day}
                onChange={(e) => setPick((prev) => ({ ...prev, day: e.target.value }))}
              />
            </div>
          )}
          <div className="flex flex-col gap-8">
            <span className="text-secondary font-bold text-muted">{rt.TIMES_LABEL}</span>
            <div>
              <div role="status" aria-live="polite">
                {statusText && <p className="text-body text-muted">{statusText}</p>}
              </div>
              <SlotsBody
                view={view}
                starts={query.data}
                error={query.error}
                timeZone={timeZone}
                onRetry={() => { void query.refetch(); }}
                onSelect={(start) => {
                  picked.current = true;
                  onPick(start, pick.day);
                }}
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-10 border-t border-divider px-24 pt-14 pb-20">
          <Button variant="secondary" onClick={onClose}>{rt.PICK_CANCEL}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
