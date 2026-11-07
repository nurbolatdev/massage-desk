import { StyleSheet, View } from "react-native";

import { LOADING_LABEL } from "@/lib/data/appointmentCard";
import { colors, radii, space } from "@/theme";

// from the NoteSheet mockup
const SKELETON_HEIGHTS = [220, 180] as const;

export function AppointmentSkeleton() {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={LOADING_LABEL} style={styles.box}>
      {SKELETON_HEIGHTS.map((height) => (
        <View key={height} style={[styles.block, { height }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: space[12] },
  block: { borderRadius: radii[22], backgroundColor: colors.segmentBg },
});
