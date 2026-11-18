import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { initials } from "@/lib/data/appointmentCard";
import type { ClientResponse } from "@/lib/data/booking";
import {
  INVALID_PHONE_TEXT,
  NAME_LABEL,
  NEW_CLIENT_INFO_AFTER,
  NEW_CLIENT_INFO_BEFORE,
  NEW_CLIENT_INFO_BOLD,
  NEW_CLIENT_LINK,
  PHONE_STEP,
  PICK_CLIENT_HINT,
  SEARCHING_LABEL,
  SEARCH_EMPTY,
  SEARCH_FAILED,
  SEARCH_OFFLINE,
  type PickerView,
} from "@/lib/data/clientPicker";
import { RETRY_LABEL } from "@/lib/data/todayState";
import { colors, radii, size, space, typography } from "@/theme";

/** Result row min height, from the NewBooking mockup. */
const CLIENT_ROW_MIN_HEIGHT = 52;
/** Avatar circle, from the NewBooking mockup. */
const AVATAR_SIZE = 36;
const CHECK_SIZE = 22;
const INFO_ICON_SIZE = 24;

type Props = {
  phoneText: string;
  onPhoneChange: (text: string) => void;
  view: PickerView;
  results: ClientResponse[];
  selectedId: string | null;
  onPick: (client: ClientResponse) => void;
  onNewClient: () => void;
  name: string;
  onNameChange: (text: string) => void;
  invalidPhone: boolean;
  onRetry: () => void;
};

export function ClientPicker({
  phoneText,
  onPhoneChange,
  view,
  results,
  selectedId,
  onPick,
  onNewClient,
  name,
  onNameChange,
  invalidPhone,
  onRetry,
}: Props) {
  const rows = view.kind === "selected" ? results.filter((client) => client.id === selectedId) : results;
  const showRows = view.kind === "selected" || view.kind === "results";

  return (
    <View style={styles.section}>
      <TextField
        label={PHONE_STEP}
        value={phoneText}
        onChangeText={onPhoneChange}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
      />
      {showRows
        ? rows.map((client) => (
            <ClientRow key={client.id} client={client} selected={client.id === selectedId} onPick={onPick} />
          ))
        : null}
      {view.kind === "searching" ? (
        <View accessible accessibilityLabel={SEARCHING_LABEL} style={styles.skeleton} />
      ) : null}
      {view.kind === "noMatch" ? <Text style={styles.hint}>{SEARCH_EMPTY}</Text> : null}
      {view.kind === "offline" ? <Text style={styles.hint}>{SEARCH_OFFLINE}</Text> : null}
      {view.kind === "error" ? (
        <>
          <Text style={styles.hint}>{SEARCH_FAILED}</Text>
          <Button label={RETRY_LABEL} onPress={onRetry} variant="outline" />
        </>
      ) : null}
      {view.showNewLink ? (
        <Pressable accessibilityRole="button" onPress={onNewClient} style={styles.link}>
          <Text style={styles.linkText}>{NEW_CLIENT_LINK}</Text>
        </Pressable>
      ) : null}
      {view.kind === "newClient" ? (
        <>
          {view.showNewInfo ? (
            <View accessible accessibilityRole="text" style={styles.info}>
              <Feather name="users" size={INFO_ICON_SIZE} color={colors.infoStrong} accessible={false} />
              <Text style={styles.infoText}>
                {NEW_CLIENT_INFO_BEFORE}
                <Text style={styles.infoBold}>{NEW_CLIENT_INFO_BOLD}</Text>
                {NEW_CLIENT_INFO_AFTER}
              </Text>
            </View>
          ) : null}
          {invalidPhone ? <Text style={styles.invalid}>{INVALID_PHONE_TEXT}</Text> : null}
          <TextField label={NAME_LABEL} value={name} onChangeText={onNameChange} autoCapitalize="words" />
        </>
      ) : null}
    </View>
  );
}

function ClientRow({
  client,
  selected,
  onPick,
}: {
  client: ClientResponse;
  selected: boolean;
  onPick: (client: ClientResponse) => void;
}) {
  const display = client.name ?? client.phone;
  const letters = initials(display);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={PICK_CLIENT_HINT}
      accessibilityState={{ selected }}
      onPress={() => onPick(client)}
      style={[styles.row, selected && styles.rowSelected]}
    >
      <View style={styles.avatar}>
        {letters === "" ? (
          <Feather name="user" size={CHECK_SIZE} color={colors.primaryStrong} accessible={false} />
        ) : (
          <Text style={styles.avatarText}>{letters}</Text>
        )}
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowName}>{display}</Text>
        {client.name ? <Text style={styles.rowPhone}>{client.phone}</Text> : null}
      </View>
      {selected ? <Feather name="check" size={CHECK_SIZE} color={colors.primaryStrong} accessible={false} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: space[8] },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[10],
    minHeight: CLIENT_ROW_MIN_HEIGHT,
    paddingVertical: space[10],
    paddingHorizontal: space[14],
    borderRadius: radii[14],
    borderWidth: 2,
    borderColor: colors.primarySoft,
    backgroundColor: colors.primarySoft,
  },
  rowSelected: { borderColor: colors.primary },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { ...typography.label, fontWeight: "800", color: colors.primaryStrong },
  rowText: { flex: 1, minWidth: 0 },
  rowName: { ...typography.body, fontWeight: "700", color: colors.primaryStrong },
  rowPhone: { ...typography.label, fontWeight: "500", color: colors.primaryStrong },
  skeleton: { height: CLIENT_ROW_MIN_HEIGHT, borderRadius: radii[14], backgroundColor: colors.segmentBg },
  hint: { ...typography.secondary, color: colors.muted },
  link: { minHeight: size.iconButton, justifyContent: "center" },
  linkText: { ...typography.secondary, fontWeight: "700", color: colors.primaryStrong },
  info: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[10],
    paddingVertical: space[12],
    paddingHorizontal: space[14],
    borderRadius: radii[14],
    backgroundColor: colors.infoSoft,
  },
  infoText: { ...typography.secondary, color: colors.infoStrong, flex: 1 },
  infoBold: { fontWeight: "700" },
  invalid: { ...typography.secondary, color: colors.dangerStrong },
});
