import { StyleSheet, Text, View } from "react-native";
import { formatTime } from "@/lib/format";
import { minutesBetween } from "@/lib/data/todaySchedule";
import { freeTimeText } from "@/lib/data/todayState";
import { colors, radii, space, typography } from "@/theme";

// from the Main mockup
const TIME_MIN_WIDTH = 56;

export function FreeTimeRow({ start, end, timeZone }: { start: Date; end: Date; timeZone?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.time}>{formatTime(start, timeZone)}</Text>
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
  time: { ...typography.secondary, fontWeight: "700", color: colors.muted, minWidth: TIME_MIN_WIDTH },
  text: { ...typography.secondary, color: colors.muted, flex: 1 },
});
