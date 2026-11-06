import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { BOT_OFF_TEXT, BOT_ON_TEXT } from "@/lib/data/todayState";
import { formatDayMonth, formatWeekday } from "@/lib/format";
import { colors, radii, size, space, typography } from "@/theme";

interface Props {
  now: Date;
  timeZone?: string;
  botEnabled?: boolean;
}

// from the Main mockup
const DOT_SIZE = 10;

export function TodayHeader({ now, timeZone, botEnabled }: Props) {
  const router = useRouter();
  return (
    <View style={styles.header}>
      <View style={styles.titles}>
        <Text style={styles.weekday}>{formatWeekday(now, timeZone)}</Text>
        <Text style={styles.date}>{formatDayMonth(now, timeZone)}</Text>
      </View>
      {botEnabled !== undefined && (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/settings")}
          style={[styles.pill, !botEnabled && styles.pillOff]}
        >
          <View style={[styles.dot, !botEnabled && styles.dotOff]} />
          <Text style={[styles.pillText, !botEnabled && styles.pillTextOff]}>
            {botEnabled ? BOT_ON_TEXT : BOT_OFF_TEXT}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: space[8],
    paddingTop: space[24],
    paddingHorizontal: space[20],
    paddingBottom: space[12],
  },
  titles: { gap: space[2] },
  weekday: { ...typography.body, color: colors.muted },
  date: { ...typography.title, letterSpacing: -0.5, color: colors.ink },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[8],
    minHeight: size.iconButton,
    paddingVertical: space[10],
    paddingHorizontal: space[14],
    borderRadius: radii.full,
    backgroundColor: colors.primarySoft,
  },
  dot: { width: DOT_SIZE, height: DOT_SIZE, borderRadius: radii.full, backgroundColor: colors.primaryMid },
  pillOff: { backgroundColor: colors.neutralSoft },
  dotOff: { backgroundColor: colors.neutralFg },
  pillTextOff: { color: colors.neutralStrong },
  pillText: { ...typography.secondary, fontWeight: "600", color: colors.primaryStrong },
});
