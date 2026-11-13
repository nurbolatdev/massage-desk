import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppointmentHeader } from "@/components/AppointmentHeader";
import { Button } from "@/components/Button";
import { CalendarHeader } from "@/components/CalendarHeader";
import { CalendarSkeleton } from "@/components/CalendarSkeleton";
import { ErrorBanner } from "@/components/ErrorBanner";
import { MonthGrid } from "@/components/MonthGrid";
import { OfflineBanner } from "@/components/OfflineBanner";
import { RefreshFailedBanner } from "@/components/RefreshFailedBanner";
import { Surface } from "@/components/Surface";
import { ACTION_FAILED } from "@/lib/data/appointmentCard";
import { NEXT_MONTH_LABEL, PREV_MONTH_LABEL, dayCounts, daysOff, monthTitle, rangeLabel } from "@/lib/data/calendar";
import { addMonths, localDay, monthDays, monthGrid } from "@/lib/data/days";
import { useCreateTimeOff, useScheduleRange, useSettings } from "@/lib/data/hooks";
import { dayRangePeriod } from "@/lib/data/timeOff";
import {
  EMPTY_PICK,
  INVALID_TIME_OFF_TEXT,
  SAVE_LABEL,
  TIME_OFF_HINT,
  TIME_OFF_OFFLINE_TEXT,
  TIME_OFF_TITLE,
  pickDay,
  pickErrorText,
  timeOffErrorKind,
  timeOffKind,
  timeOffTitle,
} from "@/lib/data/timeOffForm";
import { RETRY_LABEL, todayState } from "@/lib/data/todayState";
import { formatTime } from "@/lib/format";
import { useOnline } from "@/lib/query/online";
import { useNow } from "@/lib/time/useNow";
import { colors, radii, space, typography } from "@/theme";

export default function NewTimeOffScreen() {
  const router = useRouter();
  const now = useNow();
  const online = useOnline();
  const create = useCreateTimeOff();
  const [shown, setShown] = useState<string | null>(null);
  const [pick, setPick] = useState(EMPTY_PICK);
  const [saveError, setSaveError] = useState<string | null>(null);

  const zone = useSettings().data?.timeZone;
  const today = localDay(now, zone ?? "UTC");
  const month = shown ?? today;
  const days = monthDays(month);
  const range = useScheduleRange(zone === undefined ? undefined : days[0], zone === undefined ? undefined : days[days.length - 1]);
  const timeZone = range.timeZone;
  const hasData = range.appointments !== undefined && range.timeOff !== undefined;
  const state = todayState({ online, hasData, error: range.error, appointmentsError: range.refreshError });
  const savedAt =
    timeZone !== undefined && range.dataUpdatedAt > 0 ? formatTime(new Date(range.dataUpdatedAt), timeZone) : null;
  const counts =
    range.appointments !== undefined && timeZone !== undefined ? dayCounts(range.appointments, timeZone) : undefined;
  const off =
    range.timeOff !== undefined && timeZone !== undefined ? daysOff(range.timeOff, days, timeZone) : undefined;

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/settings");
  };

  const choose = (day: string) => {
    setPick(pickDay(pick, day, today));
    setSaveError(null);
  };

  const save = async () => {
    if (pick.from === null || pick.to === null || timeZone === undefined) return;
    setSaveError(null);
    try {
      await create.mutateAsync(dayRangePeriod(pick.from, pick.to, timeZone));
      goBack();
    } catch (error) {
      // a conflict gets its own confirmation in the next step
      setSaveError(timeOffErrorKind(error) === "invalid" ? INVALID_TIME_OFF_TEXT : ACTION_FAILED);
    }
  };

  const canSave = pick.from !== null && timeZone !== undefined && online && !create.isPending;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <AppointmentHeader title={TIME_OFF_TITLE} onBack={goBack} />
      {timeZone !== undefined && (
        <CalendarHeader
          title={monthTitle(month, today)}
          rangeLabel={rangeLabel(days)}
          onPrev={() => setShown(addMonths(month, -1))}
          onNext={() => setShown(addMonths(month, 1))}
          prevLabel={PREV_MONTH_LABEL}
          nextLabel={NEXT_MONTH_LABEL}
        />
      )}
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Text style={styles.hint}>{TIME_OFF_HINT}</Text>
        {state.view === "offlineEmpty" && <OfflineBanner savedAt={null} text={TIME_OFF_OFFLINE_TEXT} />}
        {state.view === "error" && state.errorText !== null && (
          <View style={styles.errorBox}>
            <ErrorBanner message={state.errorText} />
            {state.canRetry && <Button label={RETRY_LABEL} onPress={range.refetch} />}
          </View>
        )}
        {state.view === "list" && state.showOfflineBanner && <OfflineBanner savedAt={savedAt} text={TIME_OFF_OFFLINE_TEXT} />}
        {state.view === "list" && state.refreshFailed && <RefreshFailedBanner savedAt={savedAt} onRetry={range.refetch} />}
        {timeZone === undefined ? (
          state.view === "loading" && <CalendarSkeleton />
        ) : (
          <MonthGrid
            cells={monthGrid(month)}
            selected={pick.from ?? ""}
            today={today}
            counts={counts}
            closed={off?.closed}
            partial={off?.partial}
            onPick={choose}
          />
        )}
        {pick.error !== null && <ErrorBanner message={pickErrorText(pick.error)} />}
        {pick.from !== null && pick.to !== null && (
          <Surface style={styles.card}>
            <Text style={styles.cardTitle}>{timeOffTitle(pick.from, pick.to)}</Text>
            <Text style={styles.cardKind}>{timeOffKind(pick.from, pick.to)}</Text>
          </Surface>
        )}
        {saveError !== null && <ErrorBanner message={saveError} />}
      </ScrollView>
      <View style={styles.footer}>
        <Button label={SAVE_LABEL} onPress={() => void save()} disabled={!canSave} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  // 14 keeps month cells at 48 dp on a 360 dp screen, see MonthGrid
  content: { flexGrow: 1, paddingTop: space[4], paddingHorizontal: space[14], paddingBottom: space[24], gap: space[10] },
  hint: { ...typography.body, color: colors.muted, paddingHorizontal: space[6] },
  errorBox: { gap: space[12] },
  // from the SettingsTimeOff mockup: period card
  card: { borderRadius: radii[18], paddingVertical: space[14], paddingHorizontal: space[16] },
  cardTitle: { ...typography.body, fontWeight: "700", color: colors.ink },
  cardKind: { ...typography.secondary, color: colors.muted },
  footer: { paddingTop: space[12], paddingHorizontal: space[16], paddingBottom: space[20] },
});
