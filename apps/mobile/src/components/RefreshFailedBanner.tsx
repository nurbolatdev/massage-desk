import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { REFRESH_FAILED_TITLE, RETRY_LABEL, refreshFailedSavedText } from "@/lib/data/todayState";
import { colors, radii, size, space, typography } from "@/theme";

type Props = {
  /** Time of the schedule on screen ("09:35"); null when unknown. */
  savedAt: string | null;
  onRetry: () => void;
};

export function RefreshFailedBanner({ savedAt, onRetry }: Props) {
  return (
    <View style={styles.box}>
      <Feather name="alert-circle" size={24} color={colors.dangerStrong} accessible={false} />
      <View accessibilityLiveRegion="polite" style={styles.texts}>
        <Text style={styles.title}>{REFRESH_FAILED_TITLE}</Text>
        {savedAt !== null && <Text style={styles.text}>{refreshFailedSavedText(savedAt)}</Text>}
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={styles.buttonText}>{RETRY_LABEL}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[12],
    backgroundColor: colors.dangerSoft,
    borderRadius: radii[16],
    paddingVertical: space[12],
    paddingHorizontal: space[14],
  },
  texts: { flex: 1, gap: space[2] },
  title: { ...typography.body, fontWeight: "700", color: colors.dangerStrong },
  text: { ...typography.body, color: colors.dangerStrong },
  button: {
    minHeight: size.iconButton,
    paddingHorizontal: space[16],
    borderRadius: radii[14],
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  pressed: { opacity: 0.8 },
  buttonText: { ...typography.body, fontWeight: "700", color: colors.onPrimary },
});
