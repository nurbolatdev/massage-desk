import { Feather } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { colors, radii, space, typography } from "@/theme";

const ICON_SIZE = 22; // from the SettingsTimeOff mockup

type Props = { day: string; rest: string };

export function TimeOffConflictAlert({ day, rest }: Props) {
  return (
    <View accessible accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.box}>
      <Feather name="alert-circle" size={ICON_SIZE} color={colors.warningIcon} accessible={false} />
      <Text style={styles.text}>
        {"На "}
        <Text style={styles.day}>{day}</Text>
        {rest}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    gap: space[12],
    backgroundColor: colors.accentSoft,
    borderRadius: radii[16],
    paddingVertical: space[12],
    paddingHorizontal: space[14],
  },
  text: { ...typography.secondary, flex: 1, color: colors.accentStrong },
  day: { fontWeight: "700" },
});
