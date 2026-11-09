import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { AppointmentRow } from "@/components/AppointmentRow";
import { Button } from "@/components/Button";
import { CalendarHeader } from "@/components/CalendarHeader";
import { CalendarSkeleton } from "@/components/CalendarSkeleton";
import { ErrorBanner } from "@/components/ErrorBanner";
import { FreeTimeRow } from "@/components/FreeTimeRow";
import { OfflineBanner } from "@/components/OfflineBanner";
import { RefreshFailedBanner } from "@/components/RefreshFailedBanner";
import { WeekStrip } from "@/components/WeekStrip";
import { appointmentRouteParams } from "@/lib/data/appointmentCard";
import { BOOK_CLIENT_LABEL } from "@/lib/data/bookingNotice";
import {
  EMPTY_DAY_TEXT,
  NEXT_WEEK_LABEL,
  PREV_WEEK_LABEL,
  appointmentsOfDay,
  calendarRows,
  dayCounts,
  daySummary,
  dayTitle,
  monthTitle,
  weekRangeLabel,
} from "@/lib/data/calendar";
import { addDays, localDay, weekDays } from "@/lib/data/days";
import { useScheduleRange, useSettings } from "@/lib/data/hooks";
import { RETRY_LABEL, todayState } from "@/lib/data/todayState";
import { formatTime } from "@/lib/format";
import { useOnline } from "@/lib/query/online";
import { useNow } from "@/lib/time/useNow";
import { colors, radii, space, typography } from "@/theme";
import type { Appointment } from "@/types";

const WEEK = 7;

export default function CalendarScreen() {
  const router = useRouter();
  const now = useNow();
  const online = useOnline();
  const [picked, setPicked] = useState<string | null>(null);

  // The zone is unknown until the settings load; the week then comes from the UTC date.
  const settingsZone = useSettings().data?.timeZone;
  const today = localDay(now, settingsZone ?? "UTC");
  const selected = picked ?? today;
  const days = weekDays(selected);
  const range = useScheduleRange(
    settingsZone === undefined ? undefined : days[0],
    settingsZone === undefined ? undefined : days[WEEK - 1],
  );
  const timeZone = range.timeZone;
  const hasData = range.appointments !== undefined;
  const state = todayState({ online, hasData, error: range.error, appointmentsError: range.refreshError });
  const savedAt =
    timeZone !== undefined && range.dataUpdatedAt > 0
      ? formatTime(new Date(range.dataUpdatedAt), timeZone)
      : null;

  const counts =
    range.appointments !== undefined && timeZone !== undefined ? dayCounts(range.appointments, timeZone) : undefined;
  const dayList =
    range.appointments !== undefined && timeZone !== undefined
      ? appointmentsOfDay(range.appointments, selected, timeZone)
      : [];
  const rows = calendarRows(dayList, selected >= today);

  const open = (a: Appointment) => {
    if (timeZone === undefined) return;
    router.push({ pathname: "/appointment/[id]", params: appointmentRouteParams(a, timeZone) });
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <CalendarHeader
        title={monthTitle(selected, today)}
        rangeLabel={weekRangeLabel(days)}
        onPrev={() => setPicked(addDays(selected, -WEEK))}
        onNext={() => setPicked(addDays(selected, WEEK))}
        prevLabel={PREV_WEEK_LABEL}
        nextLabel={NEXT_WEEK_LABEL}
      >
        <WeekStrip days={days} selected={selected} today={today} counts={counts} onPick={setPicked} />
      </CalendarHeader>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headingRow}>
          <Text accessibilityRole="header" style={styles.heading}>
            {dayTitle(selected)}
          </Text>
          {state.view === "list" && <Text style={styles.summary}>{daySummary(dayList.length, selected < today)}</Text>}
        </View>

        {state.view === "loading" && <CalendarSkeleton />}

        {state.view === "offlineEmpty" && <OfflineBanner savedAt={null} />}

        {state.view === "error" && state.errorText !== null && (
          <View style={styles.errorBox}>
            <ErrorBanner message={state.errorText} />
            {state.canRetry && <Button label={RETRY_LABEL} onPress={range.refetch} />}
          </View>
        )}

        {state.view === "list" && (
          <>
            {state.showOfflineBanner && <OfflineBanner savedAt={savedAt} />}
            {state.refreshFailed && <RefreshFailedBanner savedAt={savedAt} onRetry={range.refetch} />}
            {rows.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>{EMPTY_DAY_TEXT}</Text>
              </View>
            ) : (
              <View style={styles.rows}>
                {rows.map((row) =>
                  row.kind === "appointment" ? (
                    <AppointmentRow
                      key={row.appointment.id}
                      appointment={row.appointment}
                      timeZone={timeZone}
                      onPress={() => open(row.appointment)}
                    />
                  ) : (
                    <FreeTimeRow key={`free-${row.start.getTime()}`} start={row.start} end={row.end} timeZone={timeZone} />
                  ),
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <Button label={BOOK_CLIENT_LABEL} icon="plus" disabled={!online} onPress={() => router.push("/new-appointment")} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, paddingTop: space[6], paddingHorizontal: space[16], paddingBottom: space[24], gap: space[10] },
  headingRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "baseline",
    columnGap: space[8],
    paddingHorizontal: space[4],
  },
  heading: { ...typography.subtitle, color: colors.ink },
  summary: { ...typography.secondary, color: colors.muted },
  errorBox: { gap: space[12] },
  rows: { gap: space[8] },
  emptyCard: { backgroundColor: colors.surface, borderRadius: radii[16], padding: space[20], alignItems: "center" },
  emptyText: { ...typography.body, color: colors.muted, textAlign: "center" },
  footer: { paddingVertical: space[10], paddingHorizontal: space[16] },
});
