import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { TIME_MIN_WIDTH } from "@/components/rowLayout";
import { formatTime } from "@/lib/format";
import { breakText } from "@/lib/data/todayState";
import { colors, radii, space, typography } from "@/theme";

export function BreakRow({ start, end, timeZone }: { start: Date; end: Date; timeZone?: string }) {
  const { fontScale } = useWindowDimensions();
  return (
    <View style={styles.row}>
      <Text style={[styles.time, { minWidth: Math.round(TIME_MIN_WIDTH * fontScale) }]}>{formatTime(start, timeZone)}</Text>
      <Text style={styles.text}>{breakText(formatTime(end, timeZone))}</Text>
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
    borderColor: colors.neutralSoft,
    borderRadius: radii[16],
    backgroundColor: colors.neutralSoft,
  },
  time: { ...typography.secondary, fontWeight: "700", color: colors.neutralStrong },
  text: { ...typography.secondary, color: colors.neutralStrong, flex: 1 },
});
