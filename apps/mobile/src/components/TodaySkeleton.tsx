import { StyleSheet, View } from "react-native";

import { colors, radii, space } from "@/theme";

// Sizes from the TodayLoading mockup.
const HERO_HEIGHT = 210;
const HEADING_HEIGHT = 22;
const ROW_HEIGHT = 64;
const ROW_COUNT = 4;

export function TodaySkeleton() {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Загружаем расписание…" style={styles.box}>
      <View style={styles.hero} />
      <View style={styles.heading} />
      {Array.from({ length: ROW_COUNT }, (_, i) => (
        <View key={i} style={styles.row} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: space[12] },
  hero: { height: HERO_HEIGHT, borderRadius: radii[22], backgroundColor: colors.segmentBg },
  heading: { height: HEADING_HEIGHT, width: "45%", borderRadius: radii[8], backgroundColor: colors.segmentBg },
  row: { height: ROW_HEIGHT, borderRadius: radii[16], backgroundColor: colors.segmentBg },
});
