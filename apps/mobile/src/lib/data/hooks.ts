import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "@/lib/api";

import { fetchAppointments, toAppointments } from "./appointments";
import { localDay, nextDay } from "./days";
import { queryKeys } from "./queryKeys";

const SETTINGS_STALE_TIME = 5 * 60 * 1000;

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => unwrap(api.GET("/settings")),
    staleTime: SETTINGS_STALE_TIME,
  });
}

export function useAppointments(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.appointments.range(from, to),
    queryFn: () => fetchAppointments(api, from, to),
    // The cache keeps raw JSON; Dates are made here.
    select: toAppointments,
    enabled,
  });
}

export function useTodayAppointments(now: Date) {
  const settings = useSettings();
  const timeZone = settings.data?.timeZone;
  const day = timeZone === undefined ? undefined : localDay(now, timeZone);
  const appointments = useAppointments(day ?? "", day ?? "", day !== undefined);

  const refetch = () => {
    void settings.refetch();
    void appointments.refetch();
  };

  return {
    timeZone,
    botEnabled: settings.data?.botEnabled,
    appointments: appointments.data,
    dataUpdatedAt: appointments.dataUpdatedAt,
    error: settings.error ?? appointments.error,
    refetch,
  };
}

export function useTomorrowAppointments(now: Date, enabled: boolean) {
  const settings = useSettings();
  const timeZone = settings.data?.timeZone;
  const day = timeZone === undefined ? undefined : nextDay(localDay(now, timeZone));
  const appointments = useAppointments(day ?? "", day ?? "", enabled && day !== undefined);
  return { appointments: appointments.data };
}

export function useEnableBot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.PATCH("/settings", { body: { botEnabled: true } })),
    onSuccess: (settings) => {
      queryClient.setQueryData(queryKeys.settings, settings);
    },
  });
}
