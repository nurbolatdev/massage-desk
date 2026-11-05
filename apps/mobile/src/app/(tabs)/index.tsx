import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppointmentRow } from "@/components/AppointmentRow";
import { BigButton } from "@/components/BigButton";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { OfflineBanner } from "@/components/OfflineBanner";
import { TodaySkeleton } from "@/components/TodaySkeleton";
import { useTodayAppointments } from "@/lib/data/hooks";
import { todayState } from "@/lib/data/todayState";
import { useOnline } from "@/lib/query/online";
import { callPhone, openWhatsApp } from "@/lib/contact";
import { formatDayTitle, formatTime } from "@/lib/format";
import { colors, fontSize, radius, spacing } from "@/theme";

export default function TodayScreen() {
  const now = new Date();
  const online = useOnline();
  const today = useTodayAppointments(now);
  const hasData = today.appointments !== undefined;
  const state = todayState({ online, hasData, error: today.error });
  const appointments = today.appointments ?? [];
  const next = appointments.find((a) => a.status === "confirmed" && a.end > now);
  const timeZone = today.timeZone;
  const savedAt =
    timeZone !== undefined && today.dataUpdatedAt > 0
      ? formatTime(new Date(today.dataUpdatedAt), timeZone)
      : null;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.date}>{formatDayTitle(now, timeZone)}</Text>

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
            {state.showOfflineBanner && (
              <View style={styles.banner}>
                <OfflineBanner savedAt={savedAt} />
              </View>
            )}

            {next ? (
              <View style={styles.nextCard}>
                <Text style={styles.nextLabel}>Следующий клиент</Text>
                <Text style={styles.nextTime}>{formatTime(next.start, timeZone)}</Text>
                <Text style={styles.nextName}>{next.clientName}</Text>
                <Text style={styles.nextService}>{next.serviceName}</Text>
                <View style={styles.actions}>
                  <BigButton label="Позвонить" onPress={() => void callPhone(next.clientPhone)} />
                  <BigButton label="Написать" variant="secondary" disabled={!online} onPress={() => void openWhatsApp(next.clientPhone)} />
                </View>
              </View>
            ) : (
              <View style={styles.nextCard}>
                <Text style={styles.nextName}>На сегодня больше записей нет</Text>
              </View>
            )}

            <Text style={styles.sectionTitle}>Все записи на сегодня</Text>
            {appointments.length === 0 ? (
              <Text style={styles.empty}>Сегодня записей нет</Text>
            ) : (
              appointments.map((a) => <AppointmentRow key={a.id} appointment={a} timeZone={timeZone} />)
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  banner: { marginBottom: spacing.md },
  errorBox: { gap: spacing.md },
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  date: { fontSize: fontSize.title, fontWeight: "700", color: colors.text, marginBottom: spacing.md },
  nextCard: {
    backgroundColor: colors.surface,
    borderRadius: radius,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  nextLabel: { fontSize: fontSize.body, color: colors.textMuted },
  nextTime: { fontSize: fontSize.hero, fontWeight: "800", color: colors.primary, marginTop: spacing.xs },
  nextName: { fontSize: fontSize.title, fontWeight: "700", color: colors.text },
  nextService: { fontSize: fontSize.bodyLarge, color: colors.textMuted, marginBottom: spacing.md },
  actions: { flexDirection: "row", gap: spacing.sm },
  sectionTitle: { fontSize: fontSize.bodyLarge, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  empty: { fontSize: fontSize.body, color: colors.textMuted },
});
