import { Pressable, StyleSheet, View } from "react-native";
import type { PressableProps, StyleProp, ViewProps, ViewStyle } from "react-native";

import { colors, depth } from "@/theme";

import { PRESSED_OPACITY } from "./pressed";

/** A white card or row on the page background with the level-1 depth (DESIGN.md section 6). */
export function Surface({ style, ...rest }: ViewProps) {
  return <View {...rest} style={[styles.surface, style]} />;
}

type PressableSurfaceProps = Omit<PressableProps, "style"> & { style?: StyleProp<ViewStyle> };

/** A tappable Surface; dims while pressed like the other tappable cards. */
export function PressableSurface({ style, ...rest }: PressableSurfaceProps) {
  return <Pressable {...rest} style={({ pressed }) => [styles.surface, style, pressed && styles.pressed]} />;
}

const styles = StyleSheet.create({
  surface: { backgroundColor: colors.surface, ...depth.level1 },
  pressed: { opacity: PRESSED_OPACITY },
});
