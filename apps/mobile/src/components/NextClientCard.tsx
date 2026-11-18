import { Pressable, StyleSheet, Text, View } from "react-native";
import { BigButton } from "@/components/BigButton";
import { OPEN_APPOINTMENT_HINT } from "@/lib/data/appointmentCard";
import { callPhone, openWhatsApp } from "@/lib/contact";
import { formatTime } from "@/lib/format";
import { minutesBetween } from "@/lib/data/todaySchedule";
import { CALL_LABEL, WRITE_LABEL, nextClientLabel, serviceLine, untilText } from "@/lib/data/todayState";
import { colors, radii, space, typography } from "@/theme";
import type { Appointment } from "@/types";

interface Props {
  appointment: Appointment;
  now: Date;
  timeZone?: string;
  online: boolean;
  onOpen?: () => void;
}

export function NextClientCard({ appointment, now, timeZone, online, onOpen }: Props) {
  const minutes = minutesBetween(appointment.start, appointment.end);
  const info = (
    <>
        <Text style={styles.label}>{nextClientLabel(appointment.start, now)}</Text>
        <View style={styles.timeRow}>
          <Text style={styles.time}>{formatTime(appointment.start, timeZone)}</Text>
          <Text style={styles.until}>{untilText(formatTime(appointment.end, timeZone))}</Text>
        </View>
        <Text style={styles.name}>{appointment.clientName}</Text>
        <Text style={styles.service}>{serviceLine(appointment.serviceName, minutes)}</Text>
    </>
  );
  return (
    <View style={styles.card}>
      {onOpen === undefined ? (
        <View style={styles.info}>{info}</View>
      ) : (
        <Pressable
          style={({ pressed }) => [styles.info, pressed && styles.pressed]}
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityHint={OPEN_APPOINTMENT_HINT}
        >
          {info}
        </Pressable>
      )}
      <View style={styles.actions}>
        <BigButton
          label={CALL_LABEL}
          icon="phone"
          tone="onPrimary"
          onPress={() => void callPhone(appointment.clientPhone)}
        />
        <BigButton
          label={WRITE_LABEL}
          icon="message-circle"
          variant="secondary"
          tone="onPrimary"
          disabled={!online}
          onPress={() => void openWhatsApp(appointment.clientPhone)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.primary,
    borderRadius: radii[22],
    paddingTop: space[20],
    paddingHorizontal: space[20],
    paddingBottom: space[16],
    gap: space[12],
  },
  pressed: { opacity: 0.8 },
  info: { gap: space[4] },
  label: { ...typography.secondary, fontWeight: "600", color: colors.onPrimaryMuted },
  timeRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: space[12] },
  time: { ...typography.display, letterSpacing: -1, color: colors.onPrimary },
  until: { ...typography.body, color: colors.onPrimaryMuted },
  name: { ...typography.titleS, fontWeight: "700", color: colors.onPrimary },
  service: { ...typography.body, color: colors.onPrimaryMuted },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space[10] },
});
