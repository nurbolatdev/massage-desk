import { useLocalSearchParams, useRouter } from "expo-router";
import { useReducer } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppointmentHeader } from "@/components/AppointmentHeader";
import { AppointmentSkeleton } from "@/components/AppointmentSkeleton";
import { BookingConflictAlert } from "@/components/BookingConflictAlert";
import { Button } from "@/components/Button";
import { ConfirmSheet } from "@/components/ConfirmSheet";
import { DayTimePicker } from "@/components/DayTimePicker";
import { ErrorBanner } from "@/components/ErrorBanner";
import { OfflineBanner } from "@/components/OfflineBanner";
import { RescheduleNowCard } from "@/components/RescheduleNowCard";
import { BACK_LABEL, NOT_FOUND_TEXT, NOT_FOUND_TITLE } from "@/lib/data/appointmentCard";
import { bookingErrorText, bookingFormReducer, initialForm } from "@/lib/data/bookingForm";
import { localDay } from "@/lib/data/days";
import { useAppointment, useRescheduleAppointment, useSlots } from "@/lib/data/hooks";
import {
  BOOKING_DAYS,
  CHOOSE_TIME,
  CONFLICT_TEXT,
  conflictTitle,
  dayChoices,
  timeChoices,
} from "@/lib/data/newBooking";
import {
  NEW_DAY,
  NEW_TIME,
  RESCHEDULE_CONFIRM_TITLE,
  RESCHEDULE_CONFIRM_YES,
  RESCHEDULE_GONE_TEXT,
  RESCHEDULE_GONE_TITLE,
  RESCHEDULE_OFFLINE_TEXT,
  RESCHEDULE_TITLE,
  rescheduleConfirmText,
  rescheduleDay,
  rescheduleErrorKind,
  rescheduleLabel,
  rescheduleSheetErrorText,
} from "@/lib/data/reschedule";
import { RETRY_LABEL, todayState } from "@/lib/data/todayState";
import { useDestructiveFlow } from "@/lib/data/useDestructiveFlow";
import { formatTime } from "@/lib/format";
import { useOnline } from "@/lib/query/online";
import { useNow } from "@/lib/time/useNow";
import { colors, space, typography } from "@/theme";

function stringParam(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export default function RescheduleScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const id = stringParam(params.id) ?? "";
  const dayParam = stringParam(params.day);
  const now = useNow();
  const online = useOnline();
  const card = useAppointment(id, dayParam);
  const state = todayState({
    online,
    hasData: card.hasData,
    error: card.refreshError,
    appointmentsError: card.refreshError,
  });
  const { appointment, timeZone } = card;
  const [form, dispatch] = useReducer(bookingFormReducer, null, () => initialForm(null));
  const reschedule = useRescheduleAppointment();

  const today = timeZone === undefined ? undefined : localDay(now, timeZone);
  const days = today === undefined ? [] : dayChoices(today, BOOKING_DAYS);
  const day =
    form.day ??
    (appointment !== undefined && timeZone !== undefined && today !== undefined
      ? rescheduleDay(localDay(appointment.start, timeZone), days, today)
      : null);
  const slots = useSlots(appointment?.serviceId ?? null, day);
  const timesState = slots.isError ? "error" : slots.data === undefined ? "loading" : "ready";

  const flow = useDestructiveFlow<"reschedule">(async () => {
    if (form.start === null || timeZone === undefined) return;
    try {
      const result = await reschedule.mutateAsync({ id, start: form.start });
      router.dismissTo({
        pathname: "/appointment/[id]",
        params: { id, day: localDay(new Date(result.start), timeZone) },
      });
    } catch (error) {
      const kind = rescheduleErrorKind(error);
      if (kind !== "taken" && kind !== "outside") throw error;
      dispatch({ type: "bookFailed", kind });
      void slots.refetch();
    }
  }, rescheduleSheetErrorText);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: "/appointment/[id]", params: { id, day: dayParam ?? "" } });
  };

  const start = form.start === null ? null : new Date(form.start);
  const errorText = form.error === null ? null : bookingErrorText(form.error);
  const ready =
    state.view === "list" && appointment !== undefined && timeZone !== undefined && today !== undefined && day !== null;
  const canReschedule = ready && appointment.status === "confirmed";
  const footerEnabled = canReschedule && start !== null && online && !flow.state.busy;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <AppointmentHeader title={RESCHEDULE_TITLE} onBack={goBack} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {card.notFound ? (
          <GoneBlock title={NOT_FOUND_TITLE} text={NOT_FOUND_TEXT} onBack={goBack} />
        ) : (
          <>
            {state.view === "loading" && <AppointmentSkeleton />}
            {state.view === "offlineEmpty" && <OfflineBanner savedAt={null} />}
            {state.view === "error" && state.errorText !== null && (
              <View style={styles.errorBox}>
                <ErrorBanner message={state.errorText} />
                {state.canRetry && <Button label={RETRY_LABEL} onPress={card.refetch} />}
              </View>
            )}
            {ready && appointment.status !== "confirmed" && (
              <GoneBlock title={RESCHEDULE_GONE_TITLE} text={RESCHEDULE_GONE_TEXT} onBack={goBack} />
            )}
            {canReschedule && (
              <>
                {!online && <OfflineBanner savedAt={null} text={RESCHEDULE_OFFLINE_TEXT} />}
                <RescheduleNowCard appointment={appointment} timeZone={timeZone} />
                <DayTimePicker
                  title={NEW_DAY}
                  timesTitle={NEW_TIME}
                  days={days}
                  day={day}
                  onDay={(next) => dispatch({ type: "dayPicked", day: next })}
                  times={timeChoices(slots.data?.starts ?? [], form.start, form.taken, timeZone)}
                  timesState={timesState}
                  onTime={(value) => dispatch({ type: "timePicked", start: value })}
                  onRetry={() => void slots.refetch()}
                />
                {form.error === "taken" && form.taken !== null && (
                  <BookingConflictAlert
                    title={conflictTitle(formatTime(new Date(form.taken), timeZone))}
                    text={CONFLICT_TEXT}
                  />
                )}
                {errorText !== null && <ErrorBanner message={errorText} />}
              </>
            )}
          </>
        )}
      </ScrollView>
      {canReschedule && (
        <View style={styles.footer}>
          <Button
            label={start === null ? CHOOSE_TIME : rescheduleLabel(start, timeZone)}
            onPress={() => flow.ask("reschedule")}
            disabled={!footerEnabled}
          />
        </View>
      )}
      {canReschedule && (
        <ConfirmSheet
          visible={flow.state.asking !== null && start !== null}
          title={RESCHEDULE_CONFIRM_TITLE}
          text={start === null ? "" : rescheduleConfirmText(appointment.start, start, timeZone)}
          confirmLabel={RESCHEDULE_CONFIRM_YES}
          confirmVariant="primary"
          confirmDisabled={!online}
          onConfirm={() => void flow.confirm()}
          onCancel={flow.dismiss}
          busy={flow.state.busy}
          error={flow.state.error ?? undefined}
        />
      )}
    </SafeAreaView>
  );
}

function GoneBlock({ title, text, onBack }: { title: string; text: string; onBack: () => void }) {
  return (
    <View style={styles.notFound}>
      <Text style={styles.notFoundTitle}>{title}</Text>
      <Text style={styles.notFoundText}>{text}</Text>
      <Button label={BACK_LABEL} variant="outline" onPress={onBack} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, paddingTop: space[4], paddingHorizontal: space[16], paddingBottom: space[24], gap: space[16] },
  errorBox: { gap: space[12] },
  footer: { paddingTop: space[12], paddingHorizontal: space[16], paddingBottom: space[20] },
  notFound: { flexGrow: 1, alignItems: "center", justifyContent: "center", gap: space[12] },
  notFoundTitle: { ...typography.titleS, color: colors.ink, textAlign: "center" },
  notFoundText: { ...typography.body, color: colors.muted, textAlign: "center" },
});
