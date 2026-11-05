import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Ellipse } from "react-native-svg";

import { colors, space, typography } from "@/theme";

// Mark sizes from the Login/Splash mockups.
const MARK_INLINE = 56;
const MARK_STACKED = 132;

type Props = { variant: "inline" | "stacked" };

function Mark({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024" accessible={false}>
      <Ellipse cx={512} cy={732} rx={292} ry={104} fill={colors.primaryMid} />
      <Ellipse cx={512} cy={556} rx={214} ry={86} fill={colors.brandMid} />
      <Ellipse cx={512} cy={404} rx={140} ry={64} fill={colors.stoneLight} />
      <Circle cx={512} cy={272} r={58} fill={colors.accent} />
    </Svg>
  );
}

export function BrandLogo({ variant }: Props) {
  const stacked = variant === "stacked";
  return (
    <View style={stacked ? styles.stacked : styles.inline}>
      <Mark size={stacked ? MARK_STACKED : MARK_INLINE} />
      <Text style={stacked ? styles.wordStacked : styles.wordInline}>
        massage<Text style={styles.desk}> desk</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  inline: { flexDirection: "row", alignItems: "center", gap: space[12] },
  stacked: { alignItems: "center", gap: space[20] },
  wordInline: { ...typography.titleS, color: colors.ink },
  wordStacked: { ...typography.title, color: colors.ink, letterSpacing: -1 },
  desk: { fontWeight: "500", color: colors.primaryMid },
});
