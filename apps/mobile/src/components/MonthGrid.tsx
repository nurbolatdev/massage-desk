import { Pressable, StyleSheet, Text, View } from "react-native";

import { COUNT_LEGEND_SAMPLE, COUNT_LEGEND_TEXT, WEEKDAYS_SHORT, dayCellLabel } from "@/lib/data/calendar";
import { NBSP } from "@/lib/format";
import { colors, radii, space, typography } from "@/theme";

interface Props {
  /** Monday first; `null` is an empty place outside the month. */
  cells: readonly (string | null)[];
  selected: string;
  today: string;
  /** Undefined while loading: the count line stays empty but keeps its height. */
  counts: Record<string, number> | undefined;
  onPick: (day: string) => void;
}

// from the CalendarMonth mockup
const MONTH_CELL_MIN_HEIGHT = 56;
const DAYS_IN_WEEK = 7;

function chunk<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

export function MonthGrid({ cells, selected, today, counts, onPick }: Props) {
  return (
    <View style={styles.root}>
      <View
        style={styles.row}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        {WEEKDAYS_SHORT.map((weekday) => (
          <Text key={weekday} style={styles.weekday}>
            {weekday}
          </Text>
        ))}
      </View>
      {chunk(cells, DAYS_IN_WEEK).map((week, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {week.map((day, columnIndex) => {
            if (day === null) return <View key={`empty-${columnIndex}`} style={styles.empty} />;
            const isSelected = day === selected;
            const count = counts === undefined ? undefined : (counts[day] ?? 0);
            return (
              <Pressable
                key={day}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={dayCellLabel(day, count, day < today)}
                hitSlop={{ left: space[2], right: space[2] }}
                onPress={() => onPick(day)}
                style={[styles.cell, isSelected && styles.cellSelected]}
              >
                <Text style={[styles.number, isSelected ? styles.onSelected : styles.ink]}>
                  {Number(day.slice(8))}
                </Text>
                <Text style={[styles.count, isSelected ? styles.countOnSelected : styles.countNormal]}>
                  {count !== undefined && count > 0 ? count : NBSP}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
      <Text style={styles.legend}>
        <Text style={styles.legendSample}>{COUNT_LEGEND_SAMPLE}</Text>
        {COUNT_LEGEND_TEXT}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space[10] },
  // 7 cells: touch width = (screen − 2 × month padding + gap) / 7 ≥ 48 dp from 360 dp (padding 14, gap 4); hitSlop = gap / 2 so neighbours never overlap
  row: { flexDirection: "row", gap: space[4] },
  weekday: { flex: 1, ...typography.label, fontWeight: "700", color: colors.muted, textAlign: "center" },
  empty: { flex: 1 },
  cell: {
    flex: 1,
    minHeight: MONTH_CELL_MIN_HEIGHT,
    borderRadius: radii[12],
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: space[2],
  },
  cellSelected: { backgroundColor: colors.primary },
  number: { ...typography.body, fontWeight: "700" },
  count: { ...typography.label, fontWeight: "800" },
  ink: { color: colors.ink },
  onSelected: { color: colors.onPrimary },
  countNormal: { color: colors.warningIcon },
  countOnSelected: { color: colors.onPrimaryMuted },
  legend: { ...typography.label, fontWeight: "500", color: colors.muted, padding: space[4] },
  legendSample: { fontWeight: "700", color: colors.warningIcon },
});
