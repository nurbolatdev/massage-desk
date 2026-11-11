import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  COUNT_LEGEND_SAMPLE,
  COUNT_LEGEND_TEXT,
  DAY_OFF_LEGEND_TEXT,
  WEEKDAYS_SHORT,
  dayCellLabel,
} from "@/lib/data/calendar";
import { NBSP } from "@/lib/format";
import { colors, radii, space, typography } from "@/theme";

interface Props {
  /** Monday first; `null` is an empty place outside the month. */
  cells: readonly (string | null)[];
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

// from the CalendarMonth mockup
const MONTH_CELL_MIN_HEIGHT = 56;
const DAYS_IN_WEEK = 7;

function chunk<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

export function MonthGrid({ cells, selected, today, counts, closed, partial, onPick }: Props) {
  const hasClosed = cells.some((day) => day !== null && (closed?.has(day) ?? false));
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
      ))}
      <View style={styles.legendRow}>
        <Text style={styles.legend}>
          <Text style={styles.legendSample}>{COUNT_LEGEND_SAMPLE}</Text>
          {COUNT_LEGEND_TEXT}
        </Text>
        {hasClosed && (
          <View style={styles.legendItem}>
            <View
              style={styles.swatch}
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
            />
            <Text style={styles.legend}>{DAY_OFF_LEGEND_TEXT}</Text>
          </View>
        )}
      </View>
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
  cellClosed: { backgroundColor: colors.neutralSoft },
  number: { ...typography.body, fontWeight: "700" },
  count: { ...typography.label, fontWeight: "800" },
  ink: { color: colors.ink },
  closedFg: { color: colors.neutralFg },
  onSelected: { color: colors.onPrimary },
  countNormal: { color: colors.muted },
  countOnSelected: { color: colors.onPrimaryMuted },
  legendRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: space[14], padding: space[4] },
  legendItem: { flexDirection: "row", alignItems: "center", gap: space[6] },
  swatch: { width: space[14], height: space[14], borderRadius: radii[4], backgroundColor: colors.neutralSoft },
  legend: { ...typography.label, fontWeight: "500", color: colors.muted },
  legendSample: { fontWeight: "700", color: colors.muted },
});
