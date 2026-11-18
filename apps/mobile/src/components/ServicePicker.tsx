import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { LOADING_LABEL } from "@/lib/data/appointmentCard";
import type { ServiceResponse } from "@/lib/data/booking";
import { SERVICE_STEP, SERVICES_EMPTY, SERVICES_FAILED, serviceMeta } from "@/lib/data/newBooking";
import { RETRY_LABEL } from "@/lib/data/todayState";
import { colors, radii, size, space, typography } from "@/theme";

const SKELETON_COUNT = 3;

type Props = {
  services: ServiceResponse[] | undefined;
  state: "loading" | "error" | "ready";
  selectedId: string | null;
  onPick: (id: string) => void;
  onRetry: () => void;
};

export function ServicePicker({ services, state, selectedId, onPick, onRetry }: Props) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>
        {SERVICE_STEP}
      </Text>
      {state === "loading" ? (
        <View accessible accessibilityLabel={LOADING_LABEL} style={styles.section}>
          {Array.from({ length: SKELETON_COUNT }, (_, index) => (
            <View key={index} style={styles.skeleton} />
          ))}
        </View>
      ) : null}
      {state === "error" ? (
        <>
          <Text style={styles.hint}>{SERVICES_FAILED}</Text>
          <Button label={RETRY_LABEL} onPress={onRetry} variant="outline" />
        </>
      ) : null}
      {state === "ready" && (services?.length ?? 0) === 0 ? <Text style={styles.hint}>{SERVICES_EMPTY}</Text> : null}
      {state === "ready"
        ? (services ?? []).map((service) => {
            const selected = service.id === selectedId;
            return (
              <Pressable
                key={service.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => onPick(service.id)}
                style={[styles.row, selected && styles.rowSelected]}
              >
                <Text style={[styles.name, selected && styles.nameSelected]}>{service.name}</Text>
                <Text style={[styles.meta, selected && styles.nameSelected]}>{serviceMeta(service.durationMin)}</Text>
              </Pressable>
            );
          })
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space[8] },
  heading: { ...typography.body, fontWeight: "700", color: colors.ink },
  hint: { ...typography.secondary, color: colors.muted },
  skeleton: { height: size.field, borderRadius: radii[16], backgroundColor: colors.segmentBg },
  row: {
    minHeight: size.field,
    borderRadius: radii[16],
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingVertical: space[8],
    paddingHorizontal: space[16],
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space[12],
  },
  rowSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  name: { ...typography.body, fontWeight: "700", color: colors.ink, flexShrink: 1 },
  nameSelected: { color: colors.onPrimary },
  meta: { ...typography.secondary, fontWeight: "600", color: colors.ink },
});
