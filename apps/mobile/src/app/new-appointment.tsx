import { Feather } from "@expo/vector-icons";
import { normalizePhone } from "@massage-desk/shared";
import { useRouter } from "expo-router";
import { useReducer, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BookingConflictAlert } from "@/components/BookingConflictAlert";
import { BookingSummaryCard } from "@/components/BookingSummaryCard";
import { Button } from "@/components/Button";
import { ClientPicker } from "@/components/ClientPicker";
import { CHIP_GAP, DAY_CHIP_HEIGHT, DayTimePicker, TIME_CHIP_HEIGHT } from "@/components/DayTimePicker";
import { ErrorBanner } from "@/components/ErrorBanner";
import { OfflineBanner } from "@/components/OfflineBanner";
import { ServicePicker } from "@/components/ServicePicker";
import { LOADING_LABEL } from "@/lib/data/appointmentCard";
import { bookingErrorKind, bookingErrorText, bookingFormReducer, initialForm } from "@/lib/data/bookingForm";
import { showBookingNotice } from "@/lib/data/bookingNotice";
import { clientStatus, pickerView, searchQuery } from "@/lib/data/clientPicker";
import { localDay } from "@/lib/data/days";
import { useBookAppointment, useClientSearch, useServices, useSettings, useSlots } from "@/lib/data/hooks";
import {
  BOOKING_DAYS,
  BOOKING_OFFLINE_TEXT,
  CLOSE_LABEL,
  CONFLICT_TEXT,
  NEW_BOOKING_TITLE,
  TIME_STEP,
  TIME_STEP_SHORT,
  conflictTitle,
  dayChoices,
  submitState,
  timeChoices,
} from "@/lib/data/newBooking";
import { LOAD_ERROR_TEXT, RETRY_LABEL, serviceLine } from "@/lib/data/todayState";
import { useDebouncedValue } from "@/lib/data/useDebouncedValue";
import { formatTime } from "@/lib/format";
import { useOnline } from "@/lib/query/online";
import { useNow } from "@/lib/time/useNow";
import { colors, radii, space, typography } from "@/theme";

const SEARCH_DELAY_MS = 300;
/** Close button, from the NewBooking mockup. */
const CLOSE_BUTTON_SIZE = 52;
const CLOSE_ICON_SIZE = 26;
// Loading placeholder for the day and time block: one row of days and one row of times.
const SKELETON_HEIGHT = DAY_CHIP_HEIGHT + CHIP_GAP + TIME_CHIP_HEIGHT;

export default function NewAppointmentScreen() {
  const router = useRouter();
  const now = useNow();
  const online = useOnline();
  const settings = useSettings();
  const services = useServices();
  const [form, dispatch] = useReducer(bookingFormReducer, null, () => initialForm(null));
  const book = useBookAppointment();
  const inFlight = useRef(false);

  const tz = settings.data?.timeZone;
  const today = tz === undefined ? undefined : localDay(now, tz);
  const day = form.day ?? today ?? null;
  const active = services.data ?? [];
  const serviceId = form.serviceId ?? (active.length === 1 ? (active[0]?.id ?? null) : null);
  const service = active.find((s) => s.id === serviceId);
  const slots = useSlots(serviceId, day);

  const debounced = useDebouncedValue(form.phoneText, SEARCH_DELAY_MS);
  const search = useClientSearch(searchQuery(debounced));
  const query = searchQuery(debounced);
  const phone = normalizePhone(form.phoneText.trim());
  const results = search.data ?? [];
  const view = pickerView({
    query,
    online,
    results,
    loading: search.isLoading || searchQuery(form.phoneText) !== searchQuery(debounced),
    failed: search.isError,
    selectedId: form.clientId,
    newClient: form.newClient,
    phone,
  });
  const status = clientStatus({ kind: view.kind, phone, name: form.name, selectedId: form.clientId });
  const submit = submitState({
    client: status,
    serviceId,
    start: form.start,
    today: today ?? "",
    timeZone: tz ?? "UTC",
    online,
    busy: book.isPending,
  });

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };
  const onSubmit = () => {
    if (inFlight.current || serviceId === null || form.start === null || tz === undefined) return;
    inFlight.current = true;
    const client = form.clientId
      ? { kind: "existing" as const, id: form.clientId }
      : { kind: "new" as const, phone: phone ?? "", name: form.name.trim() };
    book.mutate(
      { client, serviceId, start: form.start },
      {
        onSuccess: (result) => {
          showBookingNotice({
            appointmentId: result.appointment.id,
            clientName: form.clientLabel ?? form.name.trim(),
            start: new Date(result.appointment.start),
          });
          close();
        },
        onSettled: () => {
          inFlight.current = false;
        },
        onError: (error) => {
          const kind = bookingErrorKind(error);
          dispatch({ type: "bookFailed", kind });
          if (kind === "notFound") void services.refetch();
        },
      },
    );
  };

  const serviceState = services.isError ? "error" : services.data === undefined ? "loading" : "ready";
  const timesState = serviceId === null ? "noService" : slots.isError ? "error" : slots.data === undefined ? "loading" : "ready";
  const errorText = form.error === null ? null : bookingErrorText(form.error);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          {NEW_BOOKING_TITLE}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel={CLOSE_LABEL} onPress={close} style={styles.close}>
          <Feather name="x" size={CLOSE_ICON_SIZE} color={colors.ink} accessible={false} />
        </Pressable>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {!online ? <OfflineBanner savedAt={null} text={BOOKING_OFFLINE_TEXT} /> : null}
        {form.collapsed ? (
          <BookingSummaryCard
            clientLabel={form.clientLabel ?? (form.name.trim() || form.phoneText.trim())}
            serviceLine={service ? serviceLine(service.name, service.durationMin) : ""}
            onChange={() => dispatch({ type: "expanded" })}
          />
        ) : (
          <>
            <ClientPicker
              phoneText={form.phoneText}
              onPhoneChange={(text) => dispatch({ type: "phoneChanged", text })}
              view={view}
              results={results}
              selectedId={form.clientId}
              onPick={(client) => dispatch({ type: "clientPicked", client })}
              onNewClient={() => dispatch({ type: "newClientChosen" })}
              name={form.name}
              onNameChange={(name) => dispatch({ type: "nameChanged", name })}
              invalidPhone={view.kind === "newClient" && phone === null && form.phoneText.trim() !== ""}
              onRetry={() => void search.refetch()}
            />
            <ServicePicker
              services={active}
              state={serviceState}
              selectedId={serviceId}
              onPick={(id) => dispatch({ type: "servicePicked", id })}
              onRetry={() => void services.refetch()}
            />
          </>
        )}
        {settings.isError ? (
          <>
            <ErrorBanner message={LOAD_ERROR_TEXT} />
            <Button label={RETRY_LABEL} onPress={() => void settings.refetch()} variant="outline" />
          </>
        ) : tz === undefined || today === undefined || day === null ? (
          <View accessible accessibilityLabel={LOADING_LABEL} style={styles.skeleton} />
        ) : (
          <DayTimePicker
            title={form.collapsed ? TIME_STEP_SHORT : TIME_STEP}
            days={dayChoices(today, BOOKING_DAYS)}
            day={day}
            onDay={(next) => dispatch({ type: "dayPicked", day: next })}
            times={timeChoices(slots.data?.starts ?? [], form.start, form.taken, tz)}
            timesState={timesState}
            onTime={(start) => dispatch({ type: "timePicked", start })}
            onRetry={() => void slots.refetch()}
          />
        )}
        {form.error === "taken" && form.taken !== null && tz !== undefined ? (
          <BookingConflictAlert title={conflictTitle(formatTime(new Date(form.taken), tz))} text={CONFLICT_TEXT} />
        ) : null}
        {errorText !== null ? <ErrorBanner message={errorText} /> : null}
      </ScrollView>
      <View style={styles.footer}>
        <Button label={submit.label} onPress={onSubmit} disabled={!submit.enabled} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: space[16],
    paddingRight: space[12],
    paddingBottom: space[6],
    paddingLeft: space[20],
  },
  title: { ...typography.titleS, color: colors.ink, flexShrink: 1 },
  close: {
    width: CLOSE_BUTTON_SIZE,
    height: CLOSE_BUTTON_SIZE,
    borderRadius: radii[16],
    alignItems: "center",
    justifyContent: "center",
  },
  content: { paddingTop: space[4], paddingHorizontal: space[16], paddingBottom: space[24], gap: space[16] },
  skeleton: { height: SKELETON_HEIGHT, borderRadius: radii[14], backgroundColor: colors.segmentBg },
  footer: { paddingTop: space[12], paddingHorizontal: space[16], paddingBottom: space[20] },
});
