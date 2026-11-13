import { StyleSheet, Text, View } from "react-native";

import type { PeriodView } from "@/lib/data/timeOffList";
import { colors, radii, space, typography } from "@/theme";

import { Surface } from "./Surface";

/** One stored day off, vacation or part-day time off (SettingsTimeOff mockup: period card). */
export function TimeOffPeriodRow({ view }: { view: PeriodView }) {
  return (
    <Surface style={styles.card}>
      <View style={styles.text}>
        <Text style={styles.title}>{view.title}</Text>
        <Text style={styles.kind}>{view.kind}</Text>
      </View>
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
  kind: { ...typography.secondary, color: colors.muted },
});
