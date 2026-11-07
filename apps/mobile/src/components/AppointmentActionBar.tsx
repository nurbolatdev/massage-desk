import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { CANCEL_LABEL, NO_SHOW_LABEL } from "@/lib/data/appointmentCard";
import { colors, radii, size, space, typography } from "@/theme";

// from the Appointment mockup
const ACTION_FLEX_BASIS = 110;
const BORDER_WIDTH = 2;

interface Props {
  showNoShow: boolean;
  onNoShow: () => void;
  onCancel: () => void;
  disabled: boolean;
}

export function AppointmentActionBar({ showNoShow, onNoShow, onCancel, disabled }: Props) {
  return (
    <View style={styles.bar}>
      {showNoShow && (
        <ActionButton label={NO_SHOW_LABEL} onPress={onNoShow} disabled={disabled} borderColor={colors.borderStrong} textColor={colors.ink} />
      )}
      <ActionButton label={CANCEL_LABEL} onPress={onCancel} disabled={disabled} borderColor={colors.dangerBorder} textColor={colors.danger} />
    </View>
  );
}

interface ButtonProps {
  label: string;
  onPress: () => void;
  disabled: boolean;
  borderColor: string;
  textColor: string;
}

function ActionButton({ label, onPress, disabled, borderColor, textColor }: ButtonProps) {
  const { fontScale } = useWindowDimensions();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { flexBasis: Math.round(ACTION_FLEX_BASIS * fontScale) },
        disabled ? styles.disabled : { borderColor },
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={[styles.label, { color: disabled ? colors.neutralFg : textColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space[8],
    paddingTop: space[12],
    paddingHorizontal: space[16],
    paddingBottom: space[20],
  },
  button: {
    flexGrow: 1,
    minHeight: size.buttonSecondary,
    borderRadius: radii[16],
    borderWidth: BORDER_WIDTH,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space[12],
  },
  disabled: { backgroundColor: colors.disabledBg, borderColor: colors.disabledBg },
  pressed: { opacity: 0.8 },
  label: { ...typography.secondary, fontWeight: "700", textAlign: "center" },
});
