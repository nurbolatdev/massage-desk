import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { AppointmentRow } from "@/components/AppointmentRow";
import { BotOffBanner } from "@/components/BotOffBanner";
import { Button } from "@/components/Button";
import { EmptyToday } from "@/components/EmptyToday";
import { ErrorBanner } from "@/components/ErrorBanner";
import { FreeTimeRow } from "@/components/FreeTimeRow";
import { NextClientCard } from "@/components/NextClientCard";
import { OfflineBanner } from "@/components/OfflineBanner";
import { RefreshFailedBanner } from "@/components/RefreshFailedBanner";
import { TodayHeader } from "@/components/TodayHeader";
import { TodaySkeleton } from "@/components/TodaySkeleton";
import { useTodayAppointments, useTomorrowAppointments } from "@/lib/data/hooks";
import { todaySchedule, tomorrowSummary } from "@/lib/data/todaySchedule";
import { EMPTY_TITLE, FINISHED_TITLE, RETRY_LABEL, moreClientsTitle, todayState } from "@/lib/data/todayState";
import { useOnline } from "@/lib/query/online";
import { formatTime } from "@/lib/format";
import { useNow } from "@/lib/time/useNow";
import { colors, space, typography } from "@/theme";

export default function TodayScreen() {
  const router = useRouter();
  const now = useNow();
  const online = useOnline();
  const today = useTodayAppointments(now);
  const hasData = today.appointments !== undefined;
  const state = todayState({ online, hasData, error: today.error, appointmentsError: today.appointmentsError });
  const schedule = todaySchedule(today.appointments ?? [], now);
  const timeZone = today.timeZone;
  const tomorrow = useTomorrowAppointments(now, schedule.kind !== "schedule" && state.view === "list");
  const savedAt =
    timeZone !== undefined && today.dataUpdatedAt > 0
      ? formatTime(new Date(today.dataUpdatedAt), timeZone)
      : null;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <TodayHeader now={now} timeZone={timeZone} botEnabled={today.botEnabled} />
      <ScrollView contentContainerStyle={styles.content}>
        {state.view === "loading" && <TodaySkeleton />}

        {state.view === "offlineEmpty" && <OfflineBanner savedAt={null} />}

        {state.view === "error" && state.errorText !== null && (
          <View style={styles.errorBox}>
            <ErrorBanner message={state.errorText} />
            {state.canRetry && <Button label={RETRY_LABEL} onPress={today.refetch} />}
          </View>
        )}

        {state.view === "list" && (
          <>
            {state.showOfflineBanner && <OfflineBanner savedAt={savedAt} />}
            {state.refreshFailed && <RefreshFailedBanner savedAt={savedAt} onRetry={today.refetch} />}
            {today.botEnabled === false && <BotOffBanner online={online} />}

            {schedule.kind === "schedule" && schedule.next !== null && (
              <>
                <NextClientCard appointment={schedule.next} now={now} timeZone={timeZone} online={online} />
                {schedule.rows.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.heading}>{moreClientsTitle(schedule.laterCount)}</Text>
                    <View style={styles.rows}>
                      {schedule.rows.map((row) =>
                        row.kind === "appointment" ? (
                          <AppointmentRow key={row.appointment.id} appointment={row.appointment} timeZone={timeZone} />
                        ) : (
                          <FreeTimeRow key={`free-${row.start.getTime()}`} start={row.start} end={row.end} timeZone={timeZone} />
                        ),
                      )}
                    </View>
                  </View>
                )}
              </>
            )}

            {schedule.kind !== "schedule" && (
              <EmptyToday
                title={schedule.kind === "empty" ? EMPTY_TITLE : FINISHED_TITLE}
                showBotText={today.botEnabled !== false}
                tomorrow={tomorrowSummary(tomorrow.appointments ?? [])}
                timeZone={timeZone}
                onTomorrowPress={() => router.push("/calendar")}
              />
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, paddingTop: space[4], paddingHorizontal: space[16], paddingBottom: space[24], gap: space[14] },
  errorBox: { gap: space[12] },
  heading: { ...typography.subtitle, color: colors.ink, marginTop: space[4], marginHorizontal: space[4] },
  section: { gap: space[8] },
  rows: { gap: space[8] },
});
