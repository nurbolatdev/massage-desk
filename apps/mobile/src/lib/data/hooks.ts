import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { api, unwrap } from "@/lib/api";

import type { AppointmentAction } from "./appointmentActions";
import { postAppointmentAction, rescheduleAppointment, withStatus } from "./appointmentActions";
import type { AppointmentListItem } from "./appointments";
import { fetchAppointments, toAppointments } from "./appointments";
import { cardLoad } from "./appointmentCard";
import type { BookInput } from "./booking";
import { bookAppointment, fetchServices, fetchSlots, searchClients } from "./booking";
import { isDay, localDay, nextDay } from "./days";
import { queryKeys } from "./queryKeys";
import { fetchTimeOff, toTimeOffPeriods } from "./timeOff";
import { fetchWorkingHours, workingWindowsOfDay } from "./workingHours";
import type { WorkingBlock, WorkingWindow } from "./workingHours";

const SETTINGS_STALE_TIME = 5 * 60 * 1000;
// Slots and search results go stale fast, so they must not outlive the session cache.
const SHORT_GC_TIME = 5 * 60 * 1000;

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

export function useTimeOff(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.timeOff.range(from, to),
    queryFn: () => fetchTimeOff(api, from, to),
    // The cache keeps raw JSON; Dates are made here.
    select: toTimeOffPeriods,
    enabled,
  });
}

export function useWorkingHours(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.workingHours,
    queryFn: () => fetchWorkingHours(api),
    staleTime: SETTINGS_STALE_TIME,
    enabled,
  });
}

export function useTodayAppointments(now: Date) {
  const settings = useSettings();
  const timeZone = settings.data?.timeZone;
  const day = timeZone === undefined ? undefined : localDay(now, timeZone);
  const appointments = useAppointments(day ?? "", day ?? "", day !== undefined);
  const hours = useWorkingHours(day !== undefined);
  const workingWindows = useMemo<WorkingWindow[] | undefined>(
    () =>
      hours.data !== undefined && day !== undefined && timeZone !== undefined
        ? workingWindowsOfDay(hours.data.blocks, day, timeZone)
        : undefined,
    [hours.data, day, timeZone],
  );

  const refetch = () => {
    void settings.refetch();
    if (day !== undefined) {
      void appointments.refetch();
      void hours.refetch();
    }
  };

  // Working hours never block the screen: their error is not part of `error` / `refreshError`.
  return {
    timeZone,
    workingWindows,
    botEnabled: settings.data?.botEnabled,
    appointments: appointments.data,
    dataUpdatedAt: appointments.dataUpdatedAt,
    error: settings.error ?? appointments.error,
    refreshError: appointments.error,
    refetch,
  };
}

export function useScheduleRange(from: string | undefined, to: string | undefined) {
  const settings = useSettings();
  const known = from !== undefined && to !== undefined;
  const appointments = useAppointments(from ?? "", to ?? "", known);
  const timeOff = useTimeOff(from ?? "", to ?? "", known);
  const hours = useWorkingHours(known);

  const refetch = () => {
    void settings.refetch();
    if (known) {
      void appointments.refetch();
      void timeOff.refetch();
      void hours.refetch();
    }
  };

  // Working hours never block the screen: their error is not part of `error` / `refreshError`.
  const workingBlocks: WorkingBlock[] | undefined = hours.data?.blocks;
  return {
    timeZone: settings.data?.timeZone,
    workingBlocks,
    appointments: appointments.data,
    timeOff: timeOff.data,
    dataUpdatedAt: appointments.dataUpdatedAt,
    error: settings.error ?? appointments.error ?? timeOff.error,
    refreshError: appointments.error ?? timeOff.error,
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

export function useAppointmentAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: AppointmentAction }) =>
      postAppointmentAction(api, id, action),
    // Fail fast when offline instead of pausing the request with the sheet stuck on "busy".
    networkMode: "always",
    onSuccess: (result) => {
      queryClient.setQueriesData<AppointmentListItem[]>(
        { queryKey: queryKeys.appointments.all },
        (items) => withStatus(items, result.id, result.status),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.appointments.all }),
  });
}

export function useRescheduleAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, start }: { id: string; start: string }) =>
      rescheduleAppointment(api, id, start),
    networkMode: "always",
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.appointments.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.slots.all }),
      ]),
  });
}

export function useAppointment(id: string, day: string | undefined) {
  const settings = useSettings();
  const valid = day !== undefined && isDay(day);
  const appointments = useAppointments(valid ? day : "", valid ? day : "", valid);
  const appointment = appointments.data?.find((a) => a.id === id);

  const refetch = () => {
    void settings.refetch();
    if (valid) void appointments.refetch();
  };

  const load = cardLoad({
    appointmentsLoaded: appointments.data !== undefined,
    settingsLoaded: settings.data !== undefined,
    settingsError: settings.error,
    appointmentsError: appointments.error,
  });

  return {
    appointment,
    notFound: !valid || (appointments.data !== undefined && appointment === undefined),
    hasData: load.hasData,
    timeZone: settings.data?.timeZone,
    refreshError: load.error,
    dataUpdatedAt: appointments.dataUpdatedAt,
    refetch,
  };
}

export function useClient(clientId: string | undefined) {
  const id = clientId ?? "";
  return useQuery({
    queryKey: queryKeys.clients.one(id),
    queryFn: () => unwrap(api.GET("/clients/{id}", { params: { path: { id } } })),
    enabled: clientId !== undefined,
  });
}

export function useUpdateClientNotes(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notes: string) =>
      unwrap(api.PATCH("/clients/{id}", { params: { path: { id: clientId } }, body: { notes } })),
    networkMode: "always",
    onSuccess: (client) => {
      queryClient.setQueryData(queryKeys.clients.one(clientId), client);
    },
  });
}

export function useServices() {
  return useQuery({
    queryKey: queryKeys.services,
    queryFn: () => fetchServices(api),
    staleTime: SETTINGS_STALE_TIME,
    select: (list) => list.filter((s) => s.active),
  });
}

export function useSlots(serviceId: string | null, day: string | null) {
  return useQuery({
    queryKey: queryKeys.slots.one(serviceId ?? "", day ?? ""),
    queryFn: () => fetchSlots(api, serviceId ?? "", day ?? ""),
    enabled: serviceId !== null && day !== null,
    staleTime: 0,
    gcTime: SHORT_GC_TIME,
  });
}

export function useClientSearch(q: string | null) {
  return useQuery({
    queryKey: queryKeys.clients.search(q ?? ""),
    queryFn: () => searchClients(api, q ?? ""),
    enabled: q !== null,
    gcTime: SHORT_GC_TIME,
  });
}

export function useBookAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BookInput) => bookAppointment(api, input),
    networkMode: "always",
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.clients.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.appointments.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.slots.all }),
      ]),
  });
}
