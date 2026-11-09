import { Feather } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radii, size, space, typography } from "@/theme";

interface Props {
  title: string;
  rangeLabel: string;
  onPrev: () => void;
  onNext: () => void;
  prevLabel: string;
  nextLabel: string;
  right?: ReactNode;
  children?: ReactNode;
}

const ARROW_ICON_SIZE = 24;
const PRESSED_OPACITY = 0.8;

export function CalendarHeader({
  title,
  rangeLabel,
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
  right,
  children,
}: Props) {
  return (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        {right}
      </View>
      <View style={styles.weekRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={prevLabel}
          onPress={onPrev}
          style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
        >
          <Feather name="chevron-left" size={ARROW_ICON_SIZE} color={colors.ink} accessible={false} />
        </Pressable>
        <Text style={styles.range}>{rangeLabel}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={nextLabel}
          onPress={onNext}
          style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
        >
          <Feather name="chevron-right" size={ARROW_ICON_SIZE} color={colors.ink} accessible={false} />
        </Pressable>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: space[24],
    paddingHorizontal: space[14],
    paddingBottom: space[10],
    gap: space[14],
  },
  titleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: space[8],
    rowGap: space[8],
    paddingHorizontal: space[6],
  },
  title: { ...typography.title, letterSpacing: -0.5, color: colors.ink, flexShrink: 1 },
  weekRow: { flexDirection: "row", alignItems: "center", gap: space[4], paddingHorizontal: space[6] },
  arrow: {
    width: size.iconButton,
    height: size.iconButton,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: PRESSED_OPACITY },
  range: { ...typography.secondary, fontWeight: "600", color: colors.muted, textAlign: "center", flex: 1 },
});
