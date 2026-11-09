import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radii, space, typography } from "@/theme";
import { PRESSED_OPACITY } from "./pressed";

interface Props {
  title: string;
  line: string | null;
  onPress: () => void;
  accessibilityHint: string;
}

// from the CalendarMonth mockup
const CHEVRON_SIZE = 22;

export function DayCard({ title, line, onPress, accessibilityHint }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={line === null ? title : `${title}. ${line}`}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.texts}>
        <Text style={styles.title}>{title}</Text>
        {line !== null && <Text style={styles.line}>{line}</Text>}
      </View>
      <Feather name="chevron-right" size={CHEVRON_SIZE} color={colors.muted} accessible={false} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[12],
    backgroundColor: colors.surface,
    borderRadius: radii[16],
    paddingVertical: space[14],
    paddingHorizontal: space[16],
  },
  pressed: { opacity: PRESSED_OPACITY },
  texts: { flex: 1, gap: space[2] },
  title: { ...typography.body, fontWeight: "700", color: colors.ink },
  line: { ...typography.secondary, color: colors.muted },
});
