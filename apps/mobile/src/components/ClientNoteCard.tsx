import { Pressable, StyleSheet, Text, View } from "react-native";

import { NOTE_ADD_LABEL, NOTE_EDIT_LABEL, NOTE_EMPTY, NOTE_LOAD_FAILED, NOTE_OFFLINE, NOTE_TITLE } from "@/lib/data/clientNote";
import { RETRY_LABEL } from "@/lib/data/todayState";
import { colors, radii, space, typography } from "@/theme";

export type NoteState = "loading" | "error" | "offline" | "ready";

type Props = {
  note: string | null;
  state: NoteState;
  online: boolean;
  onEdit: () => void;
  onRetry: () => void;
};

const MIN_TOUCH = 48;
const BAR_HEIGHT = 26;

export function ClientNoteCard({ note, state, online, onEdit, onRetry }: Props) {
  const text = note?.trim() ?? "";
  const canEdit = online && state === "ready";
  const linkLabel = text === "" ? NOTE_ADD_LABEL : NOTE_EDIT_LABEL;

  return (
    <View style={styles.box}>
      <View style={styles.head}>
        <Text style={styles.title}>{NOTE_TITLE}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={linkLabel}
          accessibilityState={{ disabled: !canEdit }}
          disabled={!canEdit}
          onPress={onEdit}
          style={styles.link}
        >
          <Text style={[styles.linkText, !canEdit && styles.linkDisabled]}>{linkLabel}</Text>
        </Pressable>
      </View>

      {state === "ready" && (text === "" ? <Text style={styles.empty}>{NOTE_EMPTY}</Text> : <Text style={styles.text}>{text}</Text>)}
      {state === "loading" && <View accessible={false} style={styles.bar} />}
      {state === "offline" && <Text style={styles.empty}>{NOTE_OFFLINE}</Text>}
      {state === "error" && (
        <View style={styles.errorRow}>
          <Text style={styles.empty}>{NOTE_LOAD_FAILED}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={RETRY_LABEL} onPress={onRetry} style={styles.link}>
            <Text style={styles.linkText}>{RETRY_LABEL}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.note,
    borderRadius: radii[18],
    paddingVertical: space[14],
    paddingHorizontal: space[16],
    gap: space[6],
  },
  head: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" },
  title: { ...typography.body, fontWeight: "700", color: colors.ink },
  link: { minHeight: MIN_TOUCH, paddingHorizontal: space[12], alignItems: "center", justifyContent: "center" },
  linkText: { ...typography.secondary, fontWeight: "700", color: colors.primaryStrong },
  linkDisabled: { color: colors.neutralFg },
  text: { ...typography.body, color: colors.ink },
  empty: { ...typography.body, color: colors.muted },
  bar: { height: BAR_HEIGHT, borderRadius: radii[8], backgroundColor: colors.segmentBg },
  errorRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: space[8] },
});
