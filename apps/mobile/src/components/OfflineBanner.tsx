import { Feather } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { OFFLINE_EMPTY_TEXT, OFFLINE_TITLE, offlineSavedText } from "@/lib/data/todayState";
import { colors, radii, space, typography } from "@/theme";

type Props = {
  /** Time of the saved schedule ("09:35"); null when nothing is saved. */
  savedAt: string | null;
};

export function OfflineBanner({ savedAt }: Props) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.box}>
      <Feather name="wifi-off" size={24} color={colors.onPrimary} accessible={false} />
      <View style={styles.texts}>
        <Text style={styles.title}>{OFFLINE_TITLE}</Text>
        <Text style={styles.text}>{savedAt === null ? OFFLINE_EMPTY_TEXT : offlineSavedText(savedAt)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[12],
    backgroundColor: colors.textStrong,
    borderRadius: radii[16],
    paddingVertical: space[12],
    paddingHorizontal: space[14],
  },
  texts: { flex: 1 },
  title: { ...typography.body, fontWeight: "700", color: colors.onPrimary },
  text: { ...typography.secondary, color: colors.onPrimaryMuted },
});
