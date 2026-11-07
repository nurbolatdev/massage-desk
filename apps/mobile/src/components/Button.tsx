import { Pressable, StyleSheet, Text } from "react-native";

import { colors, radii, size, space, typography } from "@/theme";

type Variant = "primary" | "outline" | "soft" | "danger";

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  accessibilityLabel?: string;
};

export function Button({ label, onPress, variant = "primary", disabled = false, accessibilityLabel }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        containerStyles[variant],
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={[styles.label, labelStyles[variant]]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space[16],
  },
  label: { ...typography.body, textAlign: "center" },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.6 },
});

const containerStyles = StyleSheet.create({
  primary: {
    minHeight: size.button,
    borderRadius: radii[18],
    backgroundColor: colors.primary,
  },
  danger: {
    minHeight: size.button,
    borderRadius: radii[18],
    backgroundColor: colors.danger,
  },
  outline: {
    minHeight: size.buttonSecondary,
    borderRadius: radii[16],
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: "transparent",
  },
  soft: {
    minHeight: size.buttonSecondary,
    borderRadius: radii[18],
    backgroundColor: colors.segmentBg,
  },
});

const labelStyles = StyleSheet.create({
  primary: { fontWeight: "800", color: colors.onPrimary },
  danger: { fontWeight: "800", color: colors.onPrimary },
  outline: { fontWeight: "700", color: colors.neutralStrong },
  soft: { fontWeight: "700", color: colors.ink },
});
