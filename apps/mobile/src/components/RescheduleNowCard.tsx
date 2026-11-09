import { StyleSheet, Text, View } from "react-native";
import { NOW_LABEL, clientServiceLine, currentLine } from "@/lib/data/reschedule";
import { colors, radii, space, typography } from "@/theme";
import type { Appointment } from "@/types";

interface Props {
  appointment: Appointment;
  timeZone: string;
}

/** The appointment as it is now, with the old time struck out. */
export function RescheduleNowCard({ appointment, timeZone }: Props) {
  const line = currentLine(appointment.start, timeZone);
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{NOW_LABEL}</Text>
      <Text accessibilityLabel={`${NOW_LABEL}: ${line}`} style={styles.current}>
        {line}
      </Text>
      <Text style={styles.client}>{clientServiceLine(appointment)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii[18],
    paddingVertical: space[14],
    paddingHorizontal: space[16],
    gap: space[4],
    boxShadow: `0 1px 0 ${colors.line}`,
  },
  label: { ...typography.label, color: colors.muted },
  current: {
    ...typography.subtitle,
    fontWeight: "800",
    color: colors.neutralFg,
    textDecorationLine: "line-through",
  },
  client: { ...typography.body, color: colors.ink },
});
