import { StyleSheet, Text, View } from "react-native";

import { colors, radii, space, typography } from "@/theme";

export function ErrorBanner({ message }: { message: string }) {
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.box}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radii[14],
    paddingVertical: space[12],
    paddingHorizontal: space[14],
  },
  text: { ...typography.secondary, fontWeight: "600", color: colors.dangerStrong },
});
