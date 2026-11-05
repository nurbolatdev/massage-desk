import { Pressable, StyleSheet, Text } from "react-native";
import { colors, fontSize, minTouch, radius, spacing } from "@/theme";

interface Props {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
}

export function BigButton({ label, onPress, variant = "primary", disabled = false }: Props) {
  const primary = variant === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        primary ? styles.primary : styles.secondary,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: disabled ? colors.onPrimaryMuted : primary ? colors.onPrimary : colors.primary },
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
  disabled: { backgroundColor: "transparent", borderWidth: 2, borderColor: colors.stoneLight },
  pressed: { opacity: 0.8 },
  label: { fontSize: fontSize.bodyLarge, fontWeight: "600" },
});
