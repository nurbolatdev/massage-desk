import { useState } from "react";
import { ChevronLeft, ChevronRight, CircleAlert, RefreshCw } from "lucide-react";
import { localDay, addDays, weekDays } from "@massage-desk/shared";

import { PageMain } from "@/components/PageMain";
import { PageSkeleton } from "@/components/PageSkeleton";
import { StateCard } from "@/components/StateCard";
import { Button } from "@/components/ui/button";
import { icon } from "@/components/icon";
import { gridAppointments, loadErrorText, scheduleView, weekLabel } from "@/lib/data/calendar";
import { useScheduleRange, useTimeZone } from "@/lib/data/hooks";
import { weekRange } from "@/lib/data/schedule";

import { AppointmentPanel } from "./AppointmentPanel";
import { WeekGrid } from "./WeekGrid";

const NAV_BUTTON = "flex size-target items-center justify-center rounded-8 text-ink";

export function SchedulePage() {
  const timeZone = useTimeZone();
  const today = timeZone ? localDay(new Date(), timeZone) : undefined;
  const [anchor, setAnchor] = useState<string>();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const day = anchor ?? today;
  const range = day ? weekRange(day) : undefined;
  const schedule = useScheduleRange(range?.from, range?.to);
  const days = day ? weekDays(day) : [];

  const move = (delta: number) => {
    if (!day) return;
    setAnchor(addDays(day, delta));
    setSelectedId(null);
  };

  const { appointments, timeOff, error } = schedule;
  const hasData = schedule.timeZone !== undefined && appointments !== undefined && timeOff !== undefined;
  const view = scheduleView({ hasData, error });
  const shown = appointments ? gridAppointments(appointments) : [];
  const selected = shown.find((a) => a.id === selectedId) ?? null;

  return (
    <PageMain>
      <div className="flex flex-wrap items-center gap-14">
        <h1 className="text-title text-ink">Расписание</h1>
        {range && (
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
      {view === "loading" && <PageSkeleton />}
      {view === "error" && (
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
      {view === "ready" && schedule.timeZone && appointments && timeOff && today && (
        <div className="flex flex-wrap items-start gap-16">
          <div className="min-w-0 shrink grow-999 basis-calendar-basis">
            <WeekGrid
              days={days}
              today={today}
              timeZone={schedule.timeZone}
              appointments={appointments}
              timeOff={timeOff}
              workingBlocks={schedule.workingBlocks}
              selectedId={selected?.id ?? null}
              onSelect={setSelectedId}
            />
          </div>
          <AppointmentPanel appointment={selected} timeZone={schedule.timeZone} empty={shown.length === 0} />
        </div>
      )}
    </PageMain>
  );
}
