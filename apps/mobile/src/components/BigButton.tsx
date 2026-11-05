import { Pressable, StyleSheet, Text } from "react-native";
import { colors, fontSize, minTouch, radius, spacing } from "@/theme";

interface Props {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  /** Background the button sits on: "onPrimary" = green card, "onSurface" = white card (disabled look only). */
  tone?: "onPrimary" | "onSurface";
}

export function BigButton({ label, onPress, variant = "primary", disabled = false, tone = "onSurface" }: Props) {
  const primary = variant === "primary";
  const onPrimaryCard = tone === "onPrimary";
  const disabledStyle = onPrimaryCard ? styles.disabledOnPrimary : styles.disabledOnSurface;
  const disabledText = onPrimaryCard ? colors.onPrimaryMuted : colors.muted;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        primary ? styles.primary : styles.secondary,
        disabled && disabledStyle,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: disabled ? disabledText : primary ? colors.onPrimary : colors.primary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    minHeight: minTouch,
    borderRadius: radius,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.primary },
  disabledOnPrimary: { backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.stoneLight },
  disabledOnSurface: { backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.borderStrong },
  pressed: { opacity: 0.8 },
  label: { fontSize: fontSize.bodyLarge, fontWeight: "600" },
});
