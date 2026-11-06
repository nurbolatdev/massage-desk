import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppointmentRow } from "@/components/AppointmentRow";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { FreeTimeRow } from "@/components/FreeTimeRow";
import { NextClientCard } from "@/components/NextClientCard";
import { OfflineBanner } from "@/components/OfflineBanner";
import { TodayHeader } from "@/components/TodayHeader";
import { TodaySkeleton } from "@/components/TodaySkeleton";
import { useTodayAppointments } from "@/lib/data/hooks";
import { todaySchedule } from "@/lib/data/todaySchedule";
import { EMPTY_TITLE, FINISHED_TITLE, moreClientsTitle, todayState } from "@/lib/data/todayState";
import { useOnline } from "@/lib/query/online";
import { formatTime } from "@/lib/format";
import { useNow } from "@/lib/time/useNow";
import { colors, space, typography } from "@/theme";

export default function TodayScreen() {
  const now = useNow();
  const online = useOnline();
  const today = useTodayAppointments(now);
  const hasData = today.appointments !== undefined;
  const state = todayState({ online, hasData, error: today.error });
  const schedule = todaySchedule(today.appointments ?? [], now);
  const timeZone = today.timeZone;
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
            {state.canRetry && <Button label="Обновить" onPress={today.refetch} />}
          </View>
        )}

        {state.view === "list" && (
          <>
            {state.showOfflineBanner && <OfflineBanner savedAt={savedAt} />}

            {schedule.kind === "schedule" && schedule.next !== null && (
              <>
                <NextClientCard appointment={schedule.next} now={now} timeZone={timeZone} online={online} />
                {schedule.rows.length > 0 && (
                  <>
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
                  </>
                )}
              </>
            )}

            {schedule.kind !== "schedule" && (
              <Text style={styles.emptyTitle}>{schedule.kind === "empty" ? EMPTY_TITLE : FINISHED_TITLE}</Text>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingTop: space[4], paddingHorizontal: space[16], paddingBottom: space[24], gap: space[14] },
  errorBox: { gap: space[12] },
  heading: { ...typography.subtitle, color: colors.ink, marginTop: space[4], marginHorizontal: space[4] },
  rows: { gap: space[8] },
  emptyTitle: { ...typography.titleS, color: colors.ink, textAlign: "center" },
});
