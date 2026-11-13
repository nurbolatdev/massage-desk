import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { removeLabel, type PeriodView } from "@/lib/data/timeOffList";
import { colors, radii, size, space, typography } from "@/theme";

import { Surface } from "./Surface";

// from the SettingsTimeOff mockup
const REMOVE_ICON_SIZE = 20;

/** One stored day off, vacation or part-day time off (SettingsTimeOff mockup: period card). */
export function TimeOffPeriodRow({
  view,
  onRemove,
  removeDisabled,
}: {
  view: PeriodView;
  onRemove: () => void;
  removeDisabled: boolean;
}) {
  return (
    <Surface style={styles.card}>
      <View style={styles.text}>
        <Text style={styles.title}>{view.title}</Text>
        <Text style={styles.kind}>{view.kind}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={removeLabel(view)}
        accessibilityState={{ disabled: removeDisabled }}
        disabled={removeDisabled}
        onPress={onRemove}
        style={[styles.remove, removeDisabled && styles.removeDisabled]}
      >
        <Feather name="trash" size={REMOVE_ICON_SIZE} color={removeDisabled ? colors.neutralFg : colors.neutralStrong} />
      </Pressable>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[12],
    borderRadius: radii[18],
    paddingVertical: space[14],
    paddingHorizontal: space[16],
  },
  text: { flex: 1, gap: space[2] },
  title: { ...typography.body, fontWeight: "700", color: colors.ink },
  remove: {
    width: size.iconButton,
    height: size.iconButton,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii[14],
    backgroundColor: colors.neutralSoft,
  },
  removeDisabled: { backgroundColor: colors.disabledBg },
  kind: { ...typography.secondary, color: colors.muted },
});
