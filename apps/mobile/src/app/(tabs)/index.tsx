import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppointmentRow } from "@/components/AppointmentRow";
import { BigButton } from "@/components/BigButton";
import { mockToday } from "@/data/mock";
import { callPhone, openWhatsApp } from "@/lib/contact";
import { formatDayTitle, formatTime } from "@/lib/format";
import { colors, fontSize, radius, spacing } from "@/theme";

export default function TodayScreen() {
  const now = new Date();
  const appointments = [...mockToday].sort((a, b) => a.start.getTime() - b.start.getTime());
  const next = appointments.find((a) => a.status === "confirmed" && a.end > now);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.date}>{formatDayTitle(now)}</Text>

        {next ? (
          <View style={styles.nextCard}>
            <Text style={styles.nextLabel}>Следующий клиент</Text>
            <Text style={styles.nextTime}>{formatTime(next.start)}</Text>
            <Text style={styles.nextName}>{next.clientName}</Text>
            <Text style={styles.nextService}>{next.serviceName}</Text>
            <View style={styles.actions}>
              <BigButton label="Позвонить" onPress={() => void callPhone(next.clientPhone)} />
              <BigButton label="Написать" variant="secondary" onPress={() => void openWhatsApp(next.clientPhone)} />
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
          appointments.map((a) => <AppointmentRow key={a.id} appointment={a} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
