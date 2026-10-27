import { StyleSheet, Text, View } from "react-native";
import { isActiveStatus } from "@massage-desk/shared";
import { formatTime } from "@/lib/format";
import { colors, fontSize, minTouch, spacing } from "@/theme";
import type { Appointment } from "@/types";

const statusColor: Record<Appointment["status"], string> = {
  confirmed: colors.confirmed,
  done: colors.confirmed,
  cancelled: colors.cancelled,
  no_show: colors.cancelled,
};

export function AppointmentRow({ appointment }: { appointment: Appointment }) {
  const inactive = !isActiveStatus(appointment.status);
  return (
    <View style={styles.row}>
      <View style={[styles.marker, { backgroundColor: statusColor[appointment.status] }]} />
      <Text style={[styles.time, inactive && styles.inactive]}>{formatTime(appointment.start)}</Text>
      <View style={styles.info}>
        <Text style={[styles.name, inactive && styles.inactive]}>{appointment.clientName}</Text>
        <Text style={styles.service}>
          {appointment.serviceName}
          {inactive ? " · отменена" : ""}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: minTouch + spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  marker: { width: 6, alignSelf: "stretch", borderRadius: 3, marginRight: spacing.md },
  time: { fontSize: fontSize.title, fontWeight: "700", color: colors.text, width: 80 },
  info: { flex: 1 },
  name: { fontSize: fontSize.bodyLarge, fontWeight: "600", color: colors.text },
  service: { fontSize: fontSize.body, color: colors.textMuted },
  inactive: { color: colors.cancelled, textDecorationLine: "line-through" },
});
