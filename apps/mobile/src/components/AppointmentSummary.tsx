import { Feather } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { BigButton } from "@/components/BigButton";
import { callPhone, openWhatsApp } from "@/lib/contact";
import { WHATSAPP_LABEL, cardDayTitle, initials, timeRange } from "@/lib/data/appointmentCard";
import { CALL_LABEL } from "@/lib/data/todayState";
import { colors, radii, space, typography } from "@/theme";
import type { Appointment } from "@/types";

// from the Appointment mockup
const AVATAR_SIZE = 52;
const AVATAR_ICON_SIZE = 24;

interface Props {
  appointment: Appointment;
  now: Date;
  timeZone: string;
  online: boolean;
}

export function AppointmentSummary({ appointment, now, timeZone, online }: Props) {
  const letters = initials(appointment.clientName);
  const cancelled = appointment.status === "cancelled";
  return (
    <View style={styles.card}>
      <View style={styles.when}>
        <Text style={styles.date}>{cardDayTitle(appointment.start, now, timeZone)}</Text>
        <Text style={[styles.time, cancelled && styles.struck]}>
          {timeRange(appointment.start, appointment.end, timeZone)}
        </Text>
      </View>
      <View style={styles.client}>
        <View style={styles.avatar}>
          {letters === "" ? (
            <Feather name="user" size={AVATAR_ICON_SIZE} color={colors.primaryStrong} accessible={false} />
          ) : (
            <Text style={styles.initials}>{letters}</Text>
          )}
        </View>
        <View style={styles.names}>
          <Text style={styles.name}>{appointment.clientName}</Text>
          <Text style={styles.phone}>{appointment.clientPhone}</Text>
        </View>
      </View>
      <View style={styles.buttons}>
        <BigButton label={CALL_LABEL} icon="phone" tone="onSurface" onPress={() => void callPhone(appointment.clientPhone)} />
        <BigButton
          label={WHATSAPP_LABEL}
          icon="message-circle"
          variant="secondary"
          disabled={!online}
          onPress={() => void openWhatsApp(appointment.clientPhone)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii[22],
    padding: space[20],
    gap: space[14],
    boxShadow: `0 1px 0 ${colors.line}`,
  },
  when: { gap: space[2] },
  date: { ...typography.secondary, color: colors.muted },
  time: { ...typography.title, letterSpacing: -0.5, color: colors.ink },
  struck: { textDecorationLine: "line-through", color: colors.neutralFg },
  client: { flexDirection: "row", alignItems: "center", gap: space[12] },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: radii.full,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: { ...typography.body, fontWeight: "800", color: colors.primaryStrong },
  names: { flex: 1 },
  name: { ...typography.subtitle, color: colors.ink },
  phone: { ...typography.body, color: colors.muted },
  buttons: { flexDirection: "row", flexWrap: "wrap", gap: space[10] },
});
