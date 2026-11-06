import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { TIME_MIN_WIDTH } from "@/components/AppointmentRow";
import { formatTime } from "@/lib/format";
import { minutesBetween } from "@/lib/data/todaySchedule";
import { freeTimeText } from "@/lib/data/todayState";
import { colors, radii, space, typography } from "@/theme";

export function FreeTimeRow({ start, end, timeZone }: { start: Date; end: Date; timeZone?: string }) {
  const { fontScale } = useWindowDimensions();
  return (
    <View style={styles.row}>
      <Text style={[styles.time, { minWidth: Math.round(TIME_MIN_WIDTH * fontScale) }]}>{formatTime(start, timeZone)}</Text>
      <Text style={styles.text}>{freeTimeText(formatTime(end, timeZone), minutesBetween(start, end))}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[12],
    paddingVertical: space[10],
    paddingHorizontal: space[14],
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.borderDashed,
    borderRadius: radii[16],
  },
  time: { ...typography.secondary, fontWeight: "700", color: colors.muted },
  text: { ...typography.secondary, color: colors.muted, flex: 1 },
});
