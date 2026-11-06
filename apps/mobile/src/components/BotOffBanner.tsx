import { Pressable, StyleSheet, Text, View } from "react-native";
import { ErrorBanner } from "@/components/ErrorBanner";
import { BOT_OFF_TEXT_LONG, BOT_OFF_TITLE, ENABLE_BOT_FAILED, ENABLE_BOT_LABEL } from "@/lib/data/todayState";
import { useEnableBot } from "@/lib/data/hooks";
import { colors, radii, size, space, typography } from "@/theme";

export function BotOffBanner({ online }: { online: boolean }) {
  const enable = useEnableBot();
  const disabled = !online || enable.isPending;
  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.texts}>
          <Text style={styles.title}>{BOT_OFF_TITLE}</Text>
          <Text style={styles.text}>{BOT_OFF_TEXT_LONG}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={() => enable.mutate()}
          style={({ pressed }) => [styles.button, disabled && styles.buttonDisabled, pressed && !disabled && styles.pressed]}
        >
          <Text style={[styles.buttonText, disabled && styles.buttonTextDisabled]}>{ENABLE_BOT_LABEL}</Text>
        </Pressable>
      </View>
      {enable.isError && <ErrorBanner message={ENABLE_BOT_FAILED} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[8] },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[12],
    paddingVertical: space[12],
    paddingHorizontal: space[14],
    borderRadius: radii[18],
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  texts: { flex: 1, gap: space[2] },
  title: { ...typography.body, fontWeight: "700", color: colors.ink },
  text: { ...typography.secondary, color: colors.muted },
  button: {
    minHeight: size.iconButton,
    paddingHorizontal: space[16],
    borderRadius: radii[14],
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  buttonDisabled: { backgroundColor: colors.disabledBg },
  buttonText: { ...typography.secondary, fontWeight: "700", color: colors.onPrimary },
  buttonTextDisabled: { color: colors.neutralFg },
  pressed: { opacity: 0.8 },
});
