import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { isActiveStatus } from "@massage-desk/shared";
import { formatTime } from "@/lib/format";
import { minutesBetween } from "@/lib/data/todaySchedule";
import { MANUAL_CHIP, serviceLine } from "@/lib/data/todayState";
import { colors, radii, space, typography } from "@/theme";
import type { Appointment } from "@/types";

// from the Main mockup
const ROW_MIN_HEIGHT = 64;
export const TIME_MIN_WIDTH = 56;

export function AppointmentRow({ appointment, timeZone }: { appointment: Appointment; timeZone?: string }) {
  const { fontScale } = useWindowDimensions();
  const inactive = !isActiveStatus(appointment.status);
  const minutes = minutesBetween(appointment.start, appointment.end);
  return (
    <View style={styles.row}>
      <Text style={[styles.time, { minWidth: Math.round(TIME_MIN_WIDTH * fontScale) }, inactive && styles.inactive]}>{formatTime(appointment.start, timeZone)}</Text>
      <View style={styles.info}>
        <Text style={[styles.name, inactive && styles.inactive]}>{appointment.clientName}</Text>
        <Text style={[styles.service, inactive && styles.inactive]}>
          {serviceLine(appointment.serviceName, minutes)}
        </Text>
      </View>
      {appointment.source === "manual" ? (
        <View style={styles.chip}>
          <Text style={styles.chipText}>{MANUAL_CHIP}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[12],
    minHeight: ROW_MIN_HEIGHT,
    paddingVertical: space[12],
    paddingHorizontal: space[14],
    borderRadius: radii[16],
    backgroundColor: colors.surface,
    boxShadow: `0 1px 0 ${colors.line}`,
  },
  time: { ...typography.body, fontWeight: "800", color: colors.ink },
  info: { flex: 1, minWidth: 0, gap: space[2] },
  name: { ...typography.body, fontWeight: "700", color: colors.ink },
  service: { ...typography.secondary, color: colors.muted },
  chip: {
    paddingVertical: space[6],
    paddingHorizontal: space[10],
    borderRadius: radii.full,
    backgroundColor: colors.neutralSoft,
  },
  chipText: { ...typography.label, color: colors.neutralStrong },
  inactive: { color: colors.neutralFg, textDecorationLine: "line-through" },
});
