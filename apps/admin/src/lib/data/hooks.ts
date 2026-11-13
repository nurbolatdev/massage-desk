import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "@/lib/api";

import { queryKeys } from "./queryKeys";
import { rescheduleAppointment } from "./reschedule";
import {
  fetchAppointments,
  fetchTimeOff,
  fetchWorkingHours,
  toAppointments,
  toTimeOffPeriods,
} from "./schedule";

const SETTINGS_STALE_TIME = 5 * 60 * 1000;

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => unwrap(api.GET("/settings")),
    staleTime: SETTINGS_STALE_TIME,
  });
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
  const hours = useQuery({
    queryKey: queryKeys.workingHours,
    queryFn: () => fetchWorkingHours(api),
    staleTime: SETTINGS_STALE_TIME,
    enabled: known,
  });

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
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.appointments.all }),
  });
}
