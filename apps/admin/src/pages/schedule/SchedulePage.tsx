import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, CircleAlert, RefreshCw } from "lucide-react";
import { localDay, addDays, weekDays } from "@massage-desk/shared";

import { PageMain } from "@/components/PageMain";
import { PageSkeleton } from "@/components/PageSkeleton";
import { StateCard } from "@/components/StateCard";
import { Button } from "@/components/ui/button";
import { icon } from "@/components/icon";
import type { AppointmentAction } from "@/lib/data/appointmentActions";
import { daySchedule, gridAppointments, loadErrorText, scheduleView, weekLabel } from "@/lib/data/calendar";
import { useScheduleRange, useTimeZone } from "@/lib/data/hooks";
import { weekRange, type Appointment } from "@/lib/data/schedule";
import { HOURS_TITLE } from "@/lib/data/workingHours";
import { useNow } from "@/lib/useNow";

import { AppointmentActionDialog } from "./AppointmentActionDialog";
import { AppointmentPanel } from "./AppointmentPanel";
import { DayGrid } from "./DayGrid";
import { DaySummary } from "./DaySummary";
import { RescheduleDialog } from "./RescheduleDialog";
import { RescheduleTimeDialog } from "./RescheduleTimeDialog";
import { WeekGrid } from "./WeekGrid";
import { WorkingHoursEditor } from "./WorkingHoursEditor";

const NAV_BUTTON = "flex size-target items-center justify-center rounded-8 text-ink";
const VIEWS = [
  ["week", "Неделя"],
  ["day", "День"],
  ["hours", HOURS_TITLE],
] as const;

type View = (typeof VIEWS)[number][0];

export function SchedulePage() {
  const timeZone = useTimeZone();
  const now = useNow();
  const today = timeZone ? localDay(now, timeZone) : undefined;
  const [view, setView] = useState<View>("week");
  const [hoursOpened, setHoursOpened] = useState(false);
  const [anchor, setAnchor] = useState<string>();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [request, setRequest] = useState<{ appointment: Appointment; start: Date } | null>(null);
  const [moving, setMoving] = useState<{
    appointment: Appointment;
    trigger: HTMLElement;
    day?: string;
    start?: Date;
  } | null>(null);
  const [action, setAction] = useState<{
    appointment: Appointment;
    kind: AppointmentAction;
    trigger: HTMLElement;
  } | null>(null);
  const nameRef = useRef<HTMLElement>(null);
  const day = anchor ?? today;
  const range = day ? weekRange(day) : undefined;
  const schedule = useScheduleRange(range?.from, range?.to);
  const days = day ? weekDays(day) : [];

  const move = (delta: number) => {
    if (!day) return;
    setAnchor(addDays(day, delta));
    setSelectedId(null);
  };

  const switchView = (next: View) => {
    if (next === view) return;
    setView(next);
    setSelectedId(null);
    if (next === "hours") setHoursOpened(true);
  };

  const { appointments, timeOff, error } = schedule;
  const hasData = schedule.timeZone !== undefined && appointments !== undefined && timeOff !== undefined;
  const status = scheduleView({ hasData, error });
  const shown = appointments ? gridAppointments(appointments) : [];
  const selected = shown.find((a) => a.id === selectedId) ?? null;
  const startAction = (kind: AppointmentAction, trigger: HTMLElement) => {
    if (!selected) return;
    setAction({ appointment: selected, kind, trigger });
  };
  const startReschedule = (trigger: HTMLElement) => {
    if (selected) setMoving({ appointment: selected, trigger });
  };
  const moveStart = moving?.start;
  const moveTz = schedule.timeZone;
  const dayData =
    view === "day" && status === "ready" && schedule.timeZone && appointments && timeOff && day
      ? daySchedule({
          day,
          timeZone: schedule.timeZone,
          appointments,
          timeOff,
          workingBlocks: schedule.workingBlocks,
          now,
        })
      : undefined;

  return (
    <PageMain>
      <div className="flex flex-wrap items-center justify-between gap-14">
        <div className="flex flex-wrap items-center gap-14">
          <h1 className="text-title text-ink">Расписание</h1>
          {view === "week" && range && (
            <div className="flex items-center gap-4 rounded-10 border border-line bg-surface p-4">
              <button type="button" aria-label="Предыдущая неделя" onClick={() => move(-7)} className={NAV_BUTTON}>
                <ChevronLeft size={icon.nav} strokeWidth={icon.stroke} aria-hidden="true" />
              </button>
              <span className="px-8 text-body font-bold">{weekLabel(days)}</span>
              <button type="button" aria-label="Следующая неделя" onClick={() => move(7)} className={NAV_BUTTON}>
                <ChevronRight size={icon.nav} strokeWidth={icon.stroke} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
        <div role="group" aria-label="Вид" className="flex flex-wrap rounded-10 bg-segment-bg p-4">
          {VIEWS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={view === id}
              onClick={() => switchView(id)}
              className={`h-target rounded-8 px-14 text-body ${view === id ? "bg-surface font-bold" : "font-semibold"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {view !== "hours" && (
        <>
          {status === "loading" && <PageSkeleton />}
          {status === "error" && (
            <StateCard
              icon={CircleAlert}
              title="Не удалось загрузить расписание"
              text={loadErrorText(error)}
              action={
                <Button variant="secondary" onClick={schedule.refetch}>
                  <RefreshCw size={icon.button} strokeWidth={icon.stroke} aria-hidden="true" />
                  Повторить
                </Button>
              }
            />
          )}
          {status === "ready" && schedule.timeZone && appointments && timeOff && today && day && (
            <div className="flex flex-wrap items-start gap-16">
              <div className="min-w-0 shrink grow-999 basis-calendar-basis">
                {dayData ? (
                  <DayGrid
                    day={day}
                    today={today}
                    now={now}
                    timeZone={schedule.timeZone}
                    schedule={dayData}
                    timeOff={timeOff}
                    selectedId={selected?.id ?? null}
                    onSelect={setSelectedId}
                    onMove={move}
                    onReschedule={(appointment, start) => setRequest({ appointment, start })}
                  />
                ) : (
                  <WeekGrid
                    days={days}
                    today={today}
                    timeZone={schedule.timeZone}
                    appointments={appointments}
                    timeOff={timeOff}
                    workingBlocks={schedule.workingBlocks}
                    selectedId={selected?.id ?? null}
                    onSelect={setSelectedId}
                    onReschedule={(appointment, start) => setRequest({ appointment, start })}
                  />
                )}
              </div>
              <div className="flex basis-panel-basis grow flex-col gap-16">
                {dayData ? (
                  <>
                    {selected && (
                      <AppointmentPanel
                        appointment={selected}
                        timeZone={schedule.timeZone}
                        empty={false}
                        now={now}
                        nameRef={nameRef}
                        onAction={startAction}
                        onReschedule={startReschedule}
                      />
                    )}
                    <DaySummary day={day} timeZone={schedule.timeZone} schedule={dayData} />
                  </>
                ) : (
                  <AppointmentPanel
                    appointment={selected}
                    timeZone={schedule.timeZone}
                    empty={shown.length === 0}
                    now={now}
                    nameRef={nameRef}
                    onAction={startAction}
                    onReschedule={startReschedule}
                  />
                )}
              </div>
            </div>
          )}
        </>
      )}
      {hoursOpened && (
        <div hidden={view !== "hours"}>
          <WorkingHoursEditor />
        </div>
      )}
      {request && schedule.timeZone && (
        <RescheduleDialog
          appointment={request.appointment}
          start={request.start}
          timeZone={schedule.timeZone}
          onClose={() => setRequest(null)}
          onDone={(id) => {
            setRequest(null);
            setSelectedId(id);
          }}
        />
      )}
      {moving && !moveStart && moveTz && today && (
        <RescheduleTimeDialog
          appointment={moving.appointment}
          timeZone={moveTz}
          today={today}
          day={moving.day}
          trigger={moving.trigger}
          onClose={() => setMoving(null)}
          onPick={(start, pickedDay) =>
            setMoving({
              appointment: moving.appointment,
              trigger: moving.trigger,
              day: pickedDay,
              start,
            })
          }
        />
      )}
      {moving && moveStart && moveTz && (
        <RescheduleDialog
          via="panel"
          appointment={moving.appointment}
          start={moveStart}
          timeZone={moveTz}
          trigger={moving.trigger}
          onClose={() =>
            setMoving({ appointment: moving.appointment, trigger: moving.trigger, day: moving.day })
          }
          onGone={() => setMoving(null)}
          onDone={(id) => {
            const newDay = localDay(moveStart, moveTz);
            setMoving(null);
            setSelectedId(id);
            if (view === "week" ? !days.includes(newDay) : day !== newDay) {
              setAnchor(newDay);
            }
          }}
          returnFocus={() => nameRef.current}
        />
      )}
      {action && schedule.timeZone && (
        <AppointmentActionDialog
          appointment={action.appointment}
          kind={action.kind}
          timeZone={schedule.timeZone}
          trigger={action.trigger}
          onClose={() => setAction(null)}
          onDone={() => setAction(null)}
          returnFocus={() => nameRef.current}
        />
      )}
    </PageMain>
  );
}
