import { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { BrandLogo } from "@/components/BrandLogo";
import { colors, radii, size, space, typography } from "@/theme";

// Share of the track covered by the bar, as in the Splash mockup.
const BAR_SHARE = 0.55;
const LOOP_MS = 1200;

export function LaunchScreen() {
  const [trackWidth, setTrackWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion || trackWidth === 0) return;
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: LOOP_MS,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, trackWidth, progress]);

  const barWidth = trackWidth * BAR_SHARE;
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-barWidth, trackWidth],
  });

  return (
    <View style={styles.screen}>
      <View style={styles.center}>
        <BrandLogo variant="stacked" />
      </View>
      <View style={styles.bottom}>
        <View
          style={styles.track}
          accessibilityRole="progressbar"
          accessibilityLabel="Загрузка"
          onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        >
          <Animated.View
            style={[
              styles.bar,
              reduceMotion
                ? styles.barStatic
                : { width: barWidth, transform: [{ translateX }] },
            ]}
          />
        </View>
        <Text style={styles.text}>Загружаем расписание…</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  bottom: {
    paddingHorizontal: space[48],
    paddingBottom: space[64],
    gap: space[12],
    alignItems: "center",
  },
  track: {
    width: "100%",
    height: size.progress,
    borderRadius: radii[4],
    backgroundColor: colors.segmentBg,
    overflow: "hidden",
  },
  bar: {
    height: size.progress,
    borderRadius: radii[4],
    backgroundColor: colors.primaryMid,
  },
  barStatic: { width: `${BAR_SHARE * 100}%` },
  text: { ...typography.body, color: colors.muted, textAlign: "center" },
});
