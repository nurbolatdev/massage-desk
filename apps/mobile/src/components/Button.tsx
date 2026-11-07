import { Feather } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { colors, radii, size, space, typography } from "@/theme";

type Variant = "primary" | "outline" | "soft" | "danger";

/** Icon size, from the TodaySuccess mockup. */
const ICON_SIZE = 22;

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  accessibilityLabel?: string;
  icon?: ComponentProps<typeof Feather>["name"];
};

export function Button({ label, onPress, variant = "primary", disabled = false, accessibilityLabel, icon }: Props) {
  const greyPrimary = disabled && variant === "primary";
  const labelColor = greyPrimary ? colors.neutralFg : labelStyles[variant].color;
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
        disabled && !greyPrimary && styles.disabled,
        greyPrimary && styles.greyPrimary,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {icon ? <Feather name={icon} size={ICON_SIZE} color={labelColor} accessible={false} /> : null}
      <Text style={[styles.label, labelStyles[variant], greyPrimary && styles.greyLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space[10],
    paddingHorizontal: space[16],
  },
  label: { ...typography.body, textAlign: "center", flexShrink: 1 },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.6 },
  greyPrimary: { backgroundColor: colors.disabledBg },
  greyLabel: { color: colors.neutralFg },
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
