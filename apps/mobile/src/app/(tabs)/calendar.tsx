import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { AppointmentRow } from "@/components/AppointmentRow";
import { Button } from "@/components/Button";
import { CalendarHeader } from "@/components/CalendarHeader";
import { CalendarSkeleton } from "@/components/CalendarSkeleton";
import { DayCard } from "@/components/DayCard";
import { ErrorBanner } from "@/components/ErrorBanner";
import { FreeDayRow, FreeTimeRow } from "@/components/FreeTimeRow";
import { MonthGrid } from "@/components/MonthGrid";
import { OfflineBanner } from "@/components/OfflineBanner";
import { RefreshFailedBanner } from "@/components/RefreshFailedBanner";
import { SegmentedControl } from "@/components/SegmentedControl";
import { WeekStrip } from "@/components/WeekStrip";
import { appointmentRouteParams } from "@/lib/data/appointmentCard";
import { BOOK_CLIENT_LABEL } from "@/lib/data/bookingNotice";
import {
  DAY_OFF_BUTTON,
  DAY_OFF_TEXT,
  EMPTY_DAY_TEXT,
  MONTH_VIEW_LABEL,
  NEXT_MONTH_LABEL,
  NEXT_WEEK_LABEL,
  OPEN_WEEK_HINT,
  PREV_MONTH_LABEL,
  PREV_WEEK_LABEL,
  VIEW_SWITCH_LABEL,
  WEEK_VIEW_LABEL,
  appointmentsOfDay,
  bookDayLabel,
  bookingDay,
  calendarRows,
  dayCardLine,
  dayCardTitle,
  dayCounts,
  daySummary,
  dayTitle,
  daysOff,
  monthTitle,
  rangeLabel,
} from "@/lib/data/calendar";
import { addDays, addMonths, localDay, monthDays, monthGrid, weekDays } from "@/lib/data/days";
import { useScheduleRange, useSettings } from "@/lib/data/hooks";
import { RETRY_LABEL, todayState } from "@/lib/data/todayState";
import { formatTime } from "@/lib/format";
import { useOnline } from "@/lib/query/online";
import { useNow } from "@/lib/time/useNow";
import { colors, radii, space, typography } from "@/theme";
import type { Appointment } from "@/types";

const WEEK = 7;

type Mode = "week" | "month";

const VIEW_OPTIONS: readonly { value: Mode; label: string }[] = [
  { value: "week", label: WEEK_VIEW_LABEL },
  { value: "month", label: MONTH_VIEW_LABEL },
];

export default function CalendarScreen() {
  const router = useRouter();
  const now = useNow();
  const online = useOnline();
  const [picked, setPicked] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("week");

  // The zone is unknown until the settings load; the week then comes from the UTC date.
  const settingsZone = useSettings().data?.timeZone;
  const today = localDay(now, settingsZone ?? "UTC");
  const selected = picked ?? today;
  const rangeDays = mode === "week" ? weekDays(selected) : monthDays(selected);
  const range = useScheduleRange(
    settingsZone === undefined ? undefined : rangeDays[0],
    settingsZone === undefined ? undefined : rangeDays[rangeDays.length - 1],
  );
  const timeZone = range.timeZone;
  const hasData = range.appointments !== undefined && range.timeOff !== undefined;
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
  const off =
    hasData && range.timeOff !== undefined && timeZone !== undefined
      ? daysOff(range.timeOff, rangeDays, timeZone)
      : undefined;
  const closedDay = off?.closed.has(selected) ?? false;
  const bookDay = bookingDay(selected, today);
  const partialDay = off?.partial.has(selected) ?? false;
  const withFree = selected >= today && !closedDay;
  const rows = calendarRows(dayList, withFree);

  const open = (a: Appointment) => {
    if (timeZone === undefined) return;
    router.push({ pathname: "/appointment/[id]", params: appointmentRouteParams(a, timeZone) });
  };

  const notices = (
    <>
      {state.view === "offlineEmpty" && <OfflineBanner savedAt={null} />}
      {state.view === "error" && state.errorText !== null && (
        <View style={styles.errorBox}>
          <ErrorBanner message={state.errorText} />
          {state.canRetry && <Button label={RETRY_LABEL} onPress={range.refetch} />}
        </View>
      )}
      {state.view === "list" && state.showOfflineBanner && <OfflineBanner savedAt={savedAt} />}
      {state.view === "list" && state.refreshFailed && <RefreshFailedBanner savedAt={savedAt} onRetry={range.refetch} />}
    </>
  );

  const dayContent = (
    <>
      {state.view === "loading" && <CalendarSkeleton />}
      {state.view === "list" && closedDay && (
        <View style={styles.offCard}>
          <Text style={styles.offText}>{DAY_OFF_TEXT}</Text>
        </View>
      )}
      {state.view === "list" &&
        (rows.length === 0 ? (
          closedDay ? null : off !== undefined && selected >= today && !partialDay ? (
            <FreeDayRow />
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>{EMPTY_DAY_TEXT}</Text>
            </View>
          )
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
        ))}
    </>
  );

  const week = mode === "week";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <CalendarHeader
        title={monthTitle(selected, today)}
        rangeLabel={rangeLabel(rangeDays)}
        onPrev={() => setPicked(week ? addDays(selected, -WEEK) : addMonths(selected, -1))}
        onNext={() => setPicked(week ? addDays(selected, WEEK) : addMonths(selected, 1))}
        prevLabel={week ? PREV_WEEK_LABEL : PREV_MONTH_LABEL}
        nextLabel={week ? NEXT_WEEK_LABEL : NEXT_MONTH_LABEL}
        right={<SegmentedControl options={VIEW_OPTIONS} value={mode} onChange={setMode} accessibilityLabel={VIEW_SWITCH_LABEL} />}
      >
        {week && <WeekStrip days={rangeDays} selected={selected} today={today} counts={counts} closed={off?.closed} partial={off?.partial} onPick={setPicked} />}
      </CalendarHeader>
      <ScrollView contentContainerStyle={week ? styles.content : styles.monthContent}>
        {week ? (
          <>
            <View style={styles.headingRow}>
              <Text accessibilityRole="header" style={styles.heading}>
                {dayTitle(selected)}
              </Text>
              {state.view === "list" && (
                <Text style={styles.summary}>{daySummary(dayList.length, selected < today, closedDay, partialDay)}</Text>
              )}
            </View>
            {notices}
            {dayContent}
          </>
        ) : (
          <>
            {notices}
            <MonthGrid
              cells={monthGrid(selected)}
              selected={selected}
              today={today}
              counts={counts}
              closed={off?.closed}
              partial={off?.partial}
              onPick={setPicked}
            />
            <DayCard
              title={dayCardTitle(selected, hasData ? dayList.length : undefined, selected < today, closedDay, partialDay)}
              line={hasData && timeZone !== undefined ? dayCardLine(dayList, withFree, timeZone) : null}
              onPress={() => setMode("week")}
              accessibilityHint={OPEN_WEEK_HINT}
            />
            {dayContent}
          </>
        )}
      </ScrollView>
      <View style={styles.footer}>
        {closedDay ? (
          <Button label={DAY_OFF_BUTTON} disabled onPress={() => undefined} />
        ) : (
          <Button
            label={bookDay === null ? BOOK_CLIENT_LABEL : bookDayLabel(bookDay)}
            icon="plus"
            disabled={!online}
            onPress={() =>
              bookDay === null
                ? router.push("/new-appointment")
                : router.push({ pathname: "/new-appointment", params: { day: bookDay } })
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, paddingTop: space[6], paddingHorizontal: space[16], paddingBottom: space[24], gap: space[10] },
  // 14 keeps month cells at 48 dp on a 360 dp screen, see MonthGrid
  monthContent: { flexGrow: 1, paddingTop: space[4], paddingHorizontal: space[14], paddingBottom: space[24], gap: space[10] },
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
  offCard: { backgroundColor: colors.neutralSoft, borderRadius: radii[18], paddingVertical: space[28], paddingHorizontal: space[20], alignItems: "center" },
  offText: { ...typography.body, fontWeight: "600", color: colors.neutralStrong, textAlign: "center" },
  emptyText: { ...typography.body, color: colors.muted, textAlign: "center" },
  footer: { paddingVertical: space[10], paddingHorizontal: space[16] },
});
