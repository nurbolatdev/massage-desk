import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { Surface } from "@/components/Surface";
import type { DetailRow } from "@/lib/data/appointmentCard";
import { colors, radii, space, typography } from "@/theme";

// from the Appointment mockup
const BOT_ICON_SIZE = 18;

interface Props {
  rows: DetailRow[];
}

export function AppointmentDetails({ rows }: Props) {
  return (
    <Surface style={styles.card}>
      {rows.map((row, index) => (
        <View key={row.label} style={[styles.row, index < rows.length - 1 && styles.divided]}>
          <Text style={styles.label}>{row.label}</Text>
          <View style={styles.valueBox}>
            {row.bot && (
              <MaterialCommunityIcons name="robot-outline" size={BOT_ICON_SIZE} color={colors.primary} accessible={false} />
            )}
            <Text style={styles.value}>{row.value}</Text>
          </View>
        </View>
      ))}
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii[22],
    paddingVertical: space[6],
    paddingHorizontal: space[20],
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    columnGap: space[12],
    paddingVertical: space[12],
  },
  divided: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  label: { ...typography.body, color: colors.muted },
  valueBox: { flexShrink: 1, flexDirection: "row", alignItems: "center", gap: space[6] },
  value: { ...typography.body, fontWeight: "700", color: colors.ink, flexShrink: 1, textAlign: "right" },
});
