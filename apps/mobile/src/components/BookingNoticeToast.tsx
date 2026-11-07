import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radii, size, space, typography } from "@/theme";

/** Check circle diameter, from the TodaySuccess mockup. */
const CHECK_CIRCLE_SIZE = 32;
const CHECK_ICON_SIZE = 18;

type Props = {
  title: string;
  text: string;
  actionLabel: string;
  onAction: () => void;
  actionDisabled: boolean;
};

export function BookingNoticeToast({ title, text, actionLabel, onAction, actionDisabled }: Props) {
  return (
    <View style={styles.box} accessibilityLiveRegion="polite">
      <View style={styles.circle}>
        <Feather name="check" size={CHECK_ICON_SIZE} color={colors.onPrimary} accessible={false} />
      </View>
      <View style={styles.texts}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.text}>{text}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        accessibilityState={{ disabled: actionDisabled }}
        disabled={actionDisabled}
        onPress={onAction}
        style={styles.action}
      >
        <Text style={[styles.actionLabel, actionDisabled && styles.actionLabelDisabled]}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[12],
    backgroundColor: colors.ink,
    borderRadius: radii[16],
    paddingVertical: space[14],
    paddingHorizontal: space[16],
  },
  circle: {
    width: CHECK_CIRCLE_SIZE,
    height: CHECK_CIRCLE_SIZE,
    borderRadius: radii.full,
    backgroundColor: colors.brandMid,
    alignItems: "center",
    justifyContent: "center",
  },
  texts: { flex: 1, gap: space[2] },
  title: { ...typography.body, fontWeight: "700", color: colors.onPrimary },
  text: { ...typography.secondary, color: colors.onPrimaryMuted },
  action: {
    minHeight: size.iconButton,
    paddingHorizontal: space[12],
    borderRadius: radii[12],
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: { ...typography.body, fontWeight: "700", color: colors.stoneLight },
  actionLabelDisabled: { color: colors.neutralFg },
});
