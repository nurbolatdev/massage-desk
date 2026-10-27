import { StyleSheet, Text, View } from "react-native";
import { colors, fontSize, spacing } from "@/theme";

export function Placeholder({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, justifyContent: "center" },
  title: { fontSize: fontSize.title, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  text: { fontSize: fontSize.body, color: colors.textMuted },
});
