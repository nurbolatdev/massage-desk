import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api, unwrap } from "@/lib/api";

import { type AppointmentAction, postAppointmentAction } from "./appointmentActions";
import {
  type ClientListItem,
  fetchClient,
  fetchClients,
  nextOffset,
  replaceInPages,
  saveClientNote,
  type SegmentFilter,
} from "./clients";
import { fetchClientsSummary } from "./clientList";
import {
  fetchClientHistory,
  fetchClientStats,
  nextHistoryOffset,
} from "./clientVisits";
import { saveSettings, type SettingsUpdate } from "./businessSettings";
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
import { saveService, type ServiceSave, upsertService } from "./serviceForm";
import { fetchServices, type Service } from "./services";
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

export function useServices() {
  return useQuery({
    queryKey: queryKeys.services,
    queryFn: () => fetchServices(api),
  });
}

/** No optimistic update: the server checks the fields. New times and prices reach /slots and the calendar. */
export function useSaveService() {
  const queryClient = useQueryClient();
  return useMutation({
    networkMode: "always",
    mutationFn: (save: ServiceSave) => saveService(api, save),
    onSuccess: async (saved) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.services });
      queryClient.setQueryData<Service[]>(queryKeys.services, (list) => upsertService(list, saved));
    },
    // Not returned: the dialog must not wait for the lists to reload.
    onSettled: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.services }),
        queryClient.invalidateQueries({ queryKey: queryKeys.slots.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.appointments.all }),
      ]);
    },
  });
}

/** No optimistic update: the server checks the zone and the appointments it moves out of the hours. */
export function useSaveSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    networkMode: "always",
    mutationFn: (body: SettingsUpdate) => saveSettings(api, body),
    onSuccess: async (settings, body) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.settings });
      queryClient.setQueryData(queryKeys.settings, settings);
      if (body.timeZone === undefined) return;
      // Not returned: the form must not wait for the lists to reload.
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.slots.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.appointments.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.timeOff.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.workingHours }),
        queryClient.invalidateQueries({ queryKey: queryKeys.clients.all }),
      ]);
    },
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

/** Free start times of a day, computed by the server; `excludeAppointmentId` does not count that appointment as busy. */
export function useDaySlots(serviceId: string, day: string | null, excludeAppointmentId?: string) {
  return useQuery(daySlotsOptions(serviceId, day, (id, d, ex) => fetchSlots(api, id, d, ex), excludeAppointmentId));
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
    onSuccess: async (week) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.workingHours });
      queryClient.setQueryData(queryKeys.workingHours, week);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.slots.all }),
  });
}

export function useClients(term: string, segment: SegmentFilter) {
  return useInfiniteQuery({
    queryKey: queryKeys.clients.list(term, segment),
    queryFn: ({ pageParam }) => fetchClients(api, term, segment, pageParam),
    initialPageParam: 0,
    getNextPageParam: nextOffset,
  });
}

export function useClientsSummary() {
  return useQuery({
    queryKey: queryKeys.clients.summary,
    queryFn: () => fetchClientsSummary(api),
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: queryKeys.clients.one(id),
    queryFn: () => fetchClient(api, id),
  });
}

export function useClientStats(id: string) {
  return useQuery({
    queryKey: queryKeys.clients.stats(id),
    queryFn: () => fetchClientStats(api, id),
  });
}

export function useClientHistory(id: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.clients.history(id),
    queryFn: ({ pageParam }) => fetchClientHistory(api, id, pageParam),
    initialPageParam: 0,
    getNextPageParam: nextHistoryOffset,
  });
}

export function useSaveClientNote(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    networkMode: "always",
    mutationFn: (notes: string) => saveClientNote(api, id, notes),
    onSuccess: async (client) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.clients.one(id) });
      queryClient.setQueryData(queryKeys.clients.one(id), client);
      // Update loaded search pages in place; notes do not change client order or search matching.
      queryClient.setQueriesData<InfiniteData<ClientListItem[]>>(
        { queryKey: queryKeys.clients.lists },
        (data) => data && { ...data, pages: replaceInPages(data.pages, client) },
      );
    },
  });
}
