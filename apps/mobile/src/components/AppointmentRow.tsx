import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { isActiveStatus } from "@massage-desk/shared";
import { formatTime } from "@/lib/format";
import { TIME_MIN_WIDTH } from "@/components/rowLayout";
import { PressableSurface, Surface } from "@/components/Surface";
import { OPEN_APPOINTMENT_HINT } from "@/lib/data/appointmentCard";
import { minutesBetween } from "@/lib/data/todaySchedule";
import { MANUAL_CHIP, serviceLine } from "@/lib/data/todayState";
import { colors, radii, space, typography } from "@/theme";
import type { Appointment } from "@/types";

const ROW_MIN_HEIGHT = 64;

interface Props {
  appointment: Appointment;
  timeZone?: string;
  onPress?: () => void;
}

export function AppointmentRow({ appointment, timeZone, onPress }: Props) {
  const { fontScale } = useWindowDimensions();
  const inactive = !isActiveStatus(appointment.status);
  const minutes = minutesBetween(appointment.start, appointment.end);
  const content = (
    <>
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
    </>
  );
  if (onPress === undefined) {
    return <Surface style={styles.row}>{content}</Surface>;
  }
  return (
    <PressableSurface
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint={OPEN_APPOINTMENT_HINT}
    >
      {content}
    </PressableSurface>
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
