import { Pressable, StyleSheet, Text, View } from "react-native";

import { CHANGE_LABEL } from "@/lib/data/newBooking";
import { colors, radii, size, space, typography } from "@/theme";

type Props = {
  clientLabel: string;
  serviceLine: string;
  onChange: () => void;
};

/** Steps 1 and 2 folded into one card (BookingConflict mockup). */
export function BookingSummaryCard({ clientLabel, serviceLine, onChange }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.texts}>
        <Text style={styles.name}>{clientLabel}</Text>
        <Text style={styles.service}>{serviceLine}</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={onChange} style={styles.change}>
        <Text style={styles.changeText}>{CHANGE_LABEL}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space[8],
    backgroundColor: colors.surface,
    borderRadius: radii[16],
    paddingVertical: space[12],
    paddingHorizontal: space[14],
    boxShadow: `0 1px 0 ${colors.line}`,
  },
  texts: { flexShrink: 1 },
  name: { ...typography.body, fontWeight: "700", color: colors.ink },
  service: { ...typography.secondary, color: colors.muted },
  change: { minHeight: size.iconButton, justifyContent: "center" },
  changeText: { ...typography.secondary, fontWeight: "700", color: colors.primaryStrong },
});
