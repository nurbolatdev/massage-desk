import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radii, space, typography } from "@/theme";

interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
}

// from the CalendarMonth mockup; hitSlop of space[2] above and below makes the touch area 48 dp
const SEGMENT_MIN_HEIGHT = 44;
const PRESSED_OPACITY = 0.8;

export function SegmentedControl<T extends string>({ options, value, onChange, accessibilityLabel }: Props<T>) {
  return (
    <View accessibilityRole="tablist" accessibilityLabel={accessibilityLabel} style={styles.track}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            hitSlop={{ top: space[2], bottom: space[2] }}
            onPress={() => {
              if (!selected) onChange(option.value);
            }}
            style={({ pressed }) => [styles.segment, selected && styles.selected, pressed && styles.pressed]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    backgroundColor: colors.segmentBg,
    borderRadius: radii[14],
    padding: space[4],
  },
  segment: {
    minHeight: SEGMENT_MIN_HEIGHT,
    paddingHorizontal: space[16],
    borderRadius: radii[10],
    alignItems: "center",
    justifyContent: "center",
  },
  selected: { backgroundColor: colors.surface },
  pressed: { opacity: PRESSED_OPACITY },
  label: { ...typography.secondary, fontWeight: "600", color: colors.muted },
  labelSelected: { fontWeight: "700", color: colors.ink },
});
