import { Pressable, StyleSheet, Text } from "react-native";
import { colors, fontSize, minTouch, radius, spacing } from "@/theme";

interface Props {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
}

export function BigButton({ label, onPress, variant = "primary" }: Props) {
  const primary = variant === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        primary ? styles.primary : styles.secondary,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.label, { color: primary ? colors.onPrimary : colors.primary }]}>{label}</Text>
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
  pressed: { opacity: 0.8 },
  label: { fontSize: fontSize.bodyLarge, fontWeight: "600" },
});
