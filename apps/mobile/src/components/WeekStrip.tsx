import { Pressable, StyleSheet, Text, View } from "react-native";

import { dayCellLabel, weekdayShort } from "@/lib/data/calendar";
import { NBSP } from "@/lib/format";
import { colors, radii, space, typography } from "@/theme";

interface Props {
  days: string[];
  selected: string;
  today: string;
  /** Undefined while loading: the count line stays empty but keeps its height. */
  counts: Record<string, number> | undefined;
  /** Days fully covered by time off; undefined while loading. */
  closed: ReadonlySet<string> | undefined;
  /** Days only partly covered by time off; undefined while loading. */
  partial: ReadonlySet<string> | undefined;
  onPick: (day: string) => void;
}

// from the Calendar mockup
const CELL_MIN_HEIGHT = 64;

export function WeekStrip({ days, selected, today, counts, closed, partial, onPick }: Props) {
  return (
    <View style={styles.row}>
      {days.map((day) => {
        const isSelected = day === selected;
        const count = counts === undefined ? undefined : (counts[day] ?? 0);
        const isClosed = !isSelected && (closed?.has(day) ?? false);
        return (
          <Pressable
            key={day}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={dayCellLabel(day, count, day < today, closed?.has(day) ?? false, partial?.has(day) ?? false)}
            hitSlop={{ left: space[2], right: space[2] }}
            onPress={() => onPick(day)}
            style={[styles.cell, isSelected && styles.cellSelected, isClosed && styles.cellClosed]}
          >
            <Text style={[styles.weekday, isSelected ? styles.onSelected : isClosed ? styles.closedFg : styles.ink]}>{weekdayShort(day)}</Text>
            <Text style={[styles.number, isSelected ? styles.onSelected : isClosed ? styles.closedFg : styles.ink]}>
              {Number(day.slice(8))}
            </Text>
            <Text style={[styles.count, isSelected ? styles.countOnSelected : styles.countNormal]}>
              {count !== undefined && count > 0 ? count : NBSP}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // 7 cells: touch width = (screen − 2 × header padding + gap) / 7 ≥ 48 dp from 360 dp; hitSlop = gap / 2 so neighbours never overlap
  row: { flexDirection: "row", gap: space[4] },
  cell: {
    flex: 1,
    minHeight: CELL_MIN_HEIGHT,
    borderRadius: radii[14],
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: space[2],
  },
  cellSelected: { backgroundColor: colors.primary },
  cellClosed: { backgroundColor: colors.neutralSoft },
  weekday: { ...typography.secondary, fontWeight: "600" },
  number: { ...typography.subtitle, fontWeight: "800" },
  count: { ...typography.label, fontWeight: "800" },
  ink: { color: colors.ink },
  closedFg: { color: colors.neutralFg },
  onSelected: { color: colors.onPrimary },
  countNormal: { color: colors.muted },
  countOnSelected: { color: colors.onPrimaryMuted },
});
