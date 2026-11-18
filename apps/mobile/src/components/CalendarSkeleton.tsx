import { StyleSheet, View } from "react-native";

import { colors, radii, space } from "@/theme";

// Row sizes from the TodayLoading mockup; the day heading is real text on the calendar.
const ROW_HEIGHT = 64;
const ROW_COUNT = 4;

export function CalendarSkeleton() {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Загружаем расписание…" style={styles.box}>
      {Array.from({ length: ROW_COUNT }, (_, i) => (
        <View key={i} style={styles.row} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: space[12] },
  row: { height: ROW_HEIGHT, borderRadius: radii[16], backgroundColor: colors.segmentBg },
});
