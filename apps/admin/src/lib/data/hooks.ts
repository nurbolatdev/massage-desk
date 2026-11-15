import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "@/lib/api";

import { type AppointmentAction, postAppointmentAction } from "./appointmentActions";
import { queryKeys } from "./queryKeys";
import { rescheduleAppointment } from "./reschedule";
import { daySlotsOptions, fetchSlots } from "./rescheduleTime";
import {
  fetchAppointments,
  fetchTimeOff,
  fetchWorkingHours,
  toAppointments,
  toTimeOffPeriods,
  type WorkingBlock,
} from "./schedule";
import { saveWorkingHours } from "./workingHours";

const SETTINGS_STALE_TIME = 5 * 60 * 1000;

function workingHoursQuery() {
  return {
    queryKey: queryKeys.workingHours,
    queryFn: () => fetchWorkingHours(api),
    staleTime: SETTINGS_STALE_TIME,
  };
}

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => unwrap(api.GET("/settings")),
    staleTime: SETTINGS_STALE_TIME,
  });
}

/** The master's time zone; undefined until the settings arrive. */
export function useTimeZone(): string | undefined {
  return useSettings().data?.timeZone;
}

/**
 * Appointments, time off and working hours of `from`..`to` (inclusive days).
 * The API accepts a window of at most 62 days: call it with `weekRange` or a single day.
 */
export function useScheduleRange(from: string | undefined, to: string | undefined) {
  const known = from !== undefined && to !== undefined;
  const settings = useSettings();
  const appointments = useQuery({
    queryKey: queryKeys.appointments.range(from ?? "", to ?? ""),
    queryFn: () => fetchAppointments(api, from ?? "", to ?? ""),
    // The cache keeps raw JSON; Dates are made here.
    select: toAppointments,
    enabled: known,
  });
  const timeOff = useQuery({
    queryKey: queryKeys.timeOff.range(from ?? "", to ?? ""),
    queryFn: () => fetchTimeOff(api, from ?? "", to ?? ""),
    select: toTimeOffPeriods,
    enabled: known,
  });
  const hours = useQuery({ ...workingHoursQuery(), enabled: known });

  const refetch = () => {
    void settings.refetch();
    if (known) {
      void appointments.refetch();
      void timeOff.refetch();
      void hours.refetch();
    }
  };

  // Working hours never block the screen: their error is not part of `error`.
  return {
    timeZone: settings.data?.timeZone,
    appointments: appointments.data,
    timeOff: timeOff.data,
    workingBlocks: hours.data?.blocks,
    dataUpdatedAt: appointments.dataUpdatedAt,
    isLoading: settings.isLoading || appointments.isLoading || timeOff.isLoading,
    error: settings.error ?? appointments.error ?? timeOff.error,
    refetch,
  };
}

/** No optimistic update: the server decides whether the new time is free. */
export function useRescheduleAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    networkMode: "always",
    mutationFn: ({ id, start }: { id: string; start: Date }) => rescheduleAppointment(api, id, start),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.appointments.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.slots.all }),
      ]),
  });
}

/** No optimistic update: the server decides whether the appointment can still change. */
export function useAppointmentAction() {
  const queryClient = useQueryClient();
  return useMutation({
    networkMode: "always",
    mutationFn: ({ id, action }: { id: string; action: AppointmentAction }) =>
      postAppointmentAction(api, id, action),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.appointments.all }),
  });
}

/** Free start times of a day; computed by the server. */
export function useDaySlots(serviceId: string, day: string | null) {
  return useQuery(daySlotsOptions(serviceId, day, (id, d) => fetchSlots(api, id, d)));
}

export function useWorkingHours() {
  return useQuery(workingHoursQuery());
}

/** No optimistic update: the server checks the week and the appointments it leaves out. */
export function useSaveWorkingHours() {
  const queryClient = useQueryClient();
  return useMutation({
    networkMode: "always",
    mutationFn: ({ blocks, force }: { blocks: WorkingBlock[]; force: boolean }) =>
      saveWorkingHours(api, blocks, force),
    onSuccess: (week) => queryClient.setQueryData(queryKeys.workingHours, week),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.slots.all }),
  });
}
