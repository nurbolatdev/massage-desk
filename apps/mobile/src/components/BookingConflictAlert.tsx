import { Feather } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { colors, radii, space, typography } from "@/theme";

const ICON_SIZE = 26; // from the BookingConflict mockup

type Props = { title: string; text: string };

export function BookingConflictAlert({ title, text }: Props) {
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.box}>
      <Feather name="alert-circle" size={ICON_SIZE} color={colors.danger} accessible={false} />
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.text}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    gap: space[12],
    backgroundColor: colors.dangerSoft,
    borderRadius: radii[16],
    paddingVertical: space[14],
    paddingHorizontal: space[16],
  },
  body: { flex: 1, gap: space[4] },
  title: { ...typography.body, fontWeight: "800", color: colors.dangerStrong },
  text: { ...typography.secondary, color: colors.dangerStrong },
});
