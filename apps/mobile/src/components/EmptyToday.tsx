import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { BrandMark } from "@/components/BrandLogo";
import { EMPTY_TEXT, tomorrowText } from "@/lib/data/todayState";
import { formatTimeShort } from "@/lib/format";
import { colors, radii, size, space, typography } from "@/theme";

interface Props {
  title: string;
  showBotText: boolean;
  tomorrow: { count: number; first: Date } | null;
  timeZone?: string;
  onTomorrowPress: () => void;
}

// from the TodayEmpty mockup
const EMPTY_MARK_SIZE = 120;
const ICON_SIZE = 22;

export function EmptyToday({ title, showBotText, tomorrow, timeZone, onTomorrowPress }: Props) {
  return (
    <View style={styles.box}>
      <BrandMark size={EMPTY_MARK_SIZE} />
      <Text style={styles.title}>{title}</Text>
      {showBotText && <Text style={styles.text}>{EMPTY_TEXT}</Text>}
      {tomorrow !== null && (
        <Pressable accessibilityRole="button" onPress={onTomorrowPress} style={styles.link}>
          <Feather name="calendar" size={ICON_SIZE} color={colors.primary} accessible={false} />
          <Text style={styles.linkText}>
            {tomorrowText(tomorrow.count, formatTimeShort(tomorrow.first, timeZone))}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, alignItems: "center", justifyContent: "center", gap: space[14], paddingHorizontal: space[20] },
  title: { ...typography.titleS, color: colors.ink, textAlign: "center" },
  text: { ...typography.body, color: colors.muted, textAlign: "center" },
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[12],
    minHeight: size.iconButton,
    paddingVertical: space[14],
    paddingHorizontal: space[20],
    borderRadius: radii[16],
    backgroundColor: colors.surface,
    boxShadow: `0 1px 0 ${colors.line}`,
  },
  linkText: { ...typography.body, fontWeight: "600", color: colors.ink, flexShrink: 1, textAlign: "center" },
});
