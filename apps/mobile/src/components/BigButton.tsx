import { Feather } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions } from "react-native";
import { colors, radii, size, space, typography } from "@/theme";

// from the Main mockup
const BUTTON_FLEX_BASIS = 140;
const ICON_SIZE = 20;

interface Props {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  /** Background the button sits on: "onPrimary" = green card, "onSurface" = white card. */
  tone?: "onPrimary" | "onSurface";
  icon?: ComponentProps<typeof Feather>["name"];
}

export function BigButton({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  tone = "onSurface",
  icon,
}: Props) {
  const { fontScale } = useWindowDimensions();
  const primary = variant === "primary";
  const onPrimaryCard = tone === "onPrimary";
  const textColor = labelColor(primary, onPrimaryCard, disabled);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { flexBasis: Math.round(BUTTON_FLEX_BASIS * fontScale) },
        onPrimaryCard ? (primary ? styles.primaryOnPrimary : styles.secondaryOnPrimary) : primary ? styles.primary : styles.secondary,
        disabled && (onPrimaryCard ? styles.disabledOnPrimary : styles.disabledOnSurface),
        pressed && !disabled && styles.pressed,
      ]}
    >
      {icon !== undefined && <Feather name={icon} size={ICON_SIZE} color={textColor} accessible={false} />}
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

function labelColor(primary: boolean, onPrimaryCard: boolean, disabled: boolean): string {
  if (onPrimaryCard) {
    if (disabled) return colors.onPrimaryMuted;
    return primary ? colors.ink : colors.onPrimary;
  }
  if (disabled) return colors.muted;
  return primary ? colors.onPrimary : colors.primaryStrong;
}

const styles = StyleSheet.create({
  base: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: size.buttonSecondary,
    borderRadius: radii[16],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space[8],
    paddingHorizontal: space[16],
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.primary },
  primaryOnPrimary: { backgroundColor: colors.surface },
  secondaryOnPrimary: { backgroundColor: "transparent", borderWidth: 2, borderColor: colors.stoneLight },
  disabledOnPrimary: { borderWidth: 2, borderColor: colors.stoneLight, backgroundColor: colors.primary },
  disabledOnSurface: { backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.borderStrong },
  pressed: { opacity: 0.8 },
  label: { ...typography.body, fontWeight: "700" },
});
