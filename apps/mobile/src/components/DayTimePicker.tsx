import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { Button } from "@/components/Button";
import { LOADING_LABEL } from "@/lib/data/appointmentCard";
import {
  type DayChoice,
  PICK_SERVICE_FIRST,
  TIMES_EMPTY,
  TIMES_FAILED,
  type TimeChoice,
  chipColumns,
  chunk,
  takenA11y,
} from "@/lib/data/newBooking";
import { RETRY_LABEL } from "@/lib/data/todayState";
import { colors, radii, space, typography } from "@/theme";

export const DAY_CHIP_HEIGHT = 52; // from the NewBooking mockup
export const TIME_CHIP_HEIGHT = 50; // from the NewBooking mockup
/** Gap between chips and rows, shared with the loading placeholder of the screen. */
export const CHIP_GAP = space[6];
const SKELETON_CHIPS = 4;

type Props = {
  title: string;
  /** Heading above the times; when set, days and times are separate sections. */
  timesTitle?: string;
  days: DayChoice[];
  day: string;
  onDay: (day: string) => void;
  times: TimeChoice[] | undefined;
  timesState: "noService" | "loading" | "error" | "ready";
  onTime: (start: string) => void;
  onRetry: () => void;
};

/** Rows of `columns` cells; the last row is padded so every chip keeps the same width. */
function Grid<T>({ items, columns, render }: { items: T[]; columns: number; render: (item: T) => React.ReactNode }) {
  return (
    <View style={styles.grid}>
      {chunk(items, columns).map((row, rowIndex) => (
        <View key={rowIndex} style={styles.gridRow}>
          {row.map(render)}
          {Array.from({ length: columns - row.length }, (_, pad) => (
            <View key={`pad-${pad}`} style={styles.pad} />
          ))}
        </View>
      ))}
    </View>
  );
}

export function DayTimePicker({ title, timesTitle, days, day, onDay, times, timesState, onTime, onRetry }: Props) {
  const { fontScale } = useWindowDimensions();
  const columns = chipColumns(fontScale);
  const list = times ?? [];

  const timesBlock = (
    <>
      {timesState === "noService" ? <Text style={styles.hint}>{PICK_SERVICE_FIRST}</Text> : null}
      {timesState === "loading" ? (
        <View accessible accessibilityLabel={LOADING_LABEL} style={styles.gridRow}>
          {Array.from({ length: SKELETON_CHIPS }, (_, index) => (
            <View key={index} style={styles.skeleton} />
          ))}
        </View>
      ) : null}
      {timesState === "error" ? (
        <>
          <Text style={styles.hint}>{TIMES_FAILED}</Text>
          <Button label={RETRY_LABEL} onPress={onRetry} variant="outline" />
        </>
      ) : null}
      {timesState === "ready" && list.length === 0 ? <Text style={styles.hint}>{TIMES_EMPTY}</Text> : null}
      {timesState === "ready" && list.length > 0 ? (
        <Grid
          items={list}
          columns={columns}
          render={(choice) => {
            const taken = choice.state === "taken";
            const selected = choice.state === "selected";
            return (
              <Pressable
                key={choice.start}
                accessibilityRole="button"
                accessibilityLabel={taken ? takenA11y(choice.label) : undefined}
                accessibilityState={taken ? { disabled: true } : { selected }}
                disabled={taken}
                onPress={() => onTime(choice.start)}
                style={[styles.timeChip, selected && styles.timeChipSelected, taken && styles.timeChipTaken]}
              >
                <Text style={[styles.timeText, selected && styles.onDark, taken && styles.timeTextTaken]}>
                  {choice.label}
                </Text>
              </Pressable>
            );
          }}
        />
      ) : null}
    </>
  );

  const dayBlock = (
    <>
      <Text accessibilityRole="header" style={styles.heading}>
        {title}
      </Text>
      <Grid
        items={days}
        columns={columns}
        render={(choice) => {
          const selected = choice.day === day;
          return (
            <Pressable
              key={choice.day}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onDay(choice.day)}
              style={[styles.dayChip, selected && styles.dayChipSelected]}
            >
              <Text style={[styles.dayText, selected && styles.onDark]}>{choice.label}</Text>
            </Pressable>
          );
        }}
      />
    </>
  );

  if (timesTitle === undefined) {
    return (
      <View style={styles.section}>
        {dayBlock}
        {timesBlock}
      </View>
    );
  }

  return (
    <View style={styles.sections}>
      <View style={styles.section}>{dayBlock}</View>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.heading}>
          {timesTitle}
        </Text>
        {timesBlock}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sections: { gap: space[16] },
  section: { gap: space[8] },
  heading: { ...typography.body, fontWeight: "700", color: colors.ink },
  hint: { ...typography.secondary, color: colors.muted },
  grid: { gap: CHIP_GAP },
  gridRow: { flexDirection: "row", gap: CHIP_GAP },
  pad: { flex: 1 },
  skeleton: { flex: 1, height: TIME_CHIP_HEIGHT, borderRadius: radii[14], backgroundColor: colors.segmentBg },
  dayChip: {
    flex: 1,
    minHeight: DAY_CHIP_HEIGHT,
    borderRadius: radii[14],
    backgroundColor: colors.segmentBg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space[4],
  },
  dayChipSelected: { backgroundColor: colors.ink },
  dayText: { ...typography.secondary, fontWeight: "700", color: colors.ink, textAlign: "center" },
  onDark: { color: colors.onPrimary },
  timeChip: {
    flex: 1,
    minHeight: TIME_CHIP_HEIGHT,
    borderRadius: radii[14],
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  timeChipSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  timeChipTaken: { borderColor: colors.warningIcon, backgroundColor: colors.dangerSoft },
  timeText: { ...typography.body, fontWeight: "700", color: colors.ink },
  timeTextTaken: { color: colors.dangerStrong, textDecorationLine: "line-through" },
});
