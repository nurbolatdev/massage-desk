import { Feather } from "@expo/vector-icons";
import type { AppointmentStatus } from "@massage-desk/shared";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BACK_LABEL, CARD_TITLE, STATUS_LABEL } from "@/lib/data/appointmentCard";
import { colors, radii, space, typography } from "@/theme";

// from the Appointment mockup
const BACK_BUTTON_SIZE = 52;
const BACK_ICON_SIZE = 26;

interface Props {
  status?: AppointmentStatus;
  onBack: () => void;
}

// a confirmed appointment is the normal case: no chip (DESIGN.md section 7)
const CHIP: Record<Exclude<AppointmentStatus, "confirmed">, { bg: string; fg: string; paddingHorizontal: number }> = {
  cancelled: { bg: colors.neutralSoft, fg: colors.neutralStrong, paddingHorizontal: space[10] },
  no_show: { bg: colors.accentSoft, fg: colors.accentStrong, paddingHorizontal: space[10] },
  done: { bg: colors.primaryFaint, fg: colors.textStrong, paddingHorizontal: space[10] },
};

export function AppointmentHeader({ status, onBack }: Props) {
  const chip = status === undefined || status === "confirmed" ? undefined : CHIP[status];
  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={BACK_LABEL} onPress={onBack} style={styles.back}>
        <Feather name="chevron-left" size={BACK_ICON_SIZE} color={colors.ink} accessible={false} />
      </Pressable>
      <Text accessibilityRole="header" style={styles.title}>
        {CARD_TITLE}
      </Text>
      {chip !== undefined && status !== undefined && status !== "confirmed" && (
        <View style={[styles.chip, { backgroundColor: chip.bg, paddingHorizontal: chip.paddingHorizontal }]}>
          <Text style={[styles.chipLabel, { color: chip.fg }]}>{STATUS_LABEL[status]}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space[4],
    paddingTop: space[16],
    paddingHorizontal: space[12],
    paddingBottom: space[8],
  },
  back: {
    width: BACK_BUTTON_SIZE,
    height: BACK_BUTTON_SIZE,
    borderRadius: radii[16],
    alignItems: "center",
    justifyContent: "center",
  },
  title: { ...typography.titleS, fontWeight: "700", color: colors.ink, flex: 1 },
  chip: { paddingVertical: space[6], borderRadius: radii.full, marginRight: space[8] },
  chipLabel: { ...typography.label },
});
