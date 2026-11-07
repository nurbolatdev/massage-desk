import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import {
  NOTE_CLOSE_LABEL,
  NOTE_FIELD_LABEL,
  NOTE_MAX_LENGTH,
  NOTE_PHRASES,
  NOTE_SAVE_LABEL,
  NOTE_TITLE,
  hasPhrase,
  noteSheetSubtitle,
  toggleNotePhrase,
} from "@/lib/data/clientNote";
import { colors, radii, space, typography } from "@/theme";

type Props = {
  visible: boolean;
  clientName: string;
  initial: string;
  onSave: (text: string) => void;
  onClose: () => void;
  busy: boolean;
  error?: string;
};

// from the NoteSheet mockup
const HANDLE_WIDTH = 44;
const HANDLE_HEIGHT = 5;
const FIELD_LINES = 4;
const FIELD_PADDING = 14;
const CHIP_HEIGHT = 48;

export function NoteSheet(props: Props) {
  const { visible, busy, onClose } = props;
  const close = () => {
    if (!busy) onClose();
  };
  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={close}
      statusBarTranslucent
    >
      <NoteForm {...props} />
    </Modal>
  );
}

// Mounted only while the modal is visible, so the text starts from `initial` on every open.
function NoteForm({
  clientName,
  initial,
  onSave,
  onClose,
  busy,
  error,
}: Props) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState(initial);

  const close = () => {
    if (!busy) onClose();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.root}
    >
      <Pressable
        accessibilityLabel={NOTE_CLOSE_LABEL}
        accessibilityRole="button"
        disabled={busy}
        onPress={close}
        style={styles.scrim}
      />
      <View
        style={[styles.sheet, { paddingBottom: space[24] + insets.bottom }]}
      >
        <View accessible={false} style={styles.handle} />
        <ScrollView
          bounces={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <View>
            <Text accessibilityRole="header" style={styles.title}>
              {NOTE_TITLE}
            </Text>
            <Text style={styles.subtitle}>{noteSheetSubtitle(clientName)}</Text>
          </View>
          <TextInput
            accessibilityLabel={NOTE_FIELD_LABEL}
            multiline
            maxLength={NOTE_MAX_LENGTH}
            value={text}
            onChangeText={setText}
            editable={!busy}
            textAlignVertical="top"
            style={styles.field}
          />
          <View style={styles.chips}>
            {NOTE_PHRASES.map((phrase) => {
              const selected = hasPhrase(text, phrase);
              return (
                <Pressable
                  key={phrase}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled: busy }}
                  disabled={busy}
                  onPress={() => setText(toggleNotePhrase(text, phrase))}
                  style={[
                    styles.chip,
                    selected ? styles.chipOn : styles.chipOff,
                  ]}
                >
                  <Text style={styles.chipText}>{phrase}</Text>
                </Pressable>
              );
            })}
          </View>
          {error ? <ErrorBanner message={error} /> : null}
          <Button
            label={NOTE_SAVE_LABEL}
            onPress={() => onSave(text)}
            disabled={busy}
          />
          <Button
            label={NOTE_CLOSE_LABEL}
            onPress={close}
            variant="soft"
            disabled={busy}
          />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end", backgroundColor: colors.scrim },
  scrim: { ...StyleSheet.absoluteFill },
  sheet: {
    maxHeight: "90%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii[28],
    borderTopRightRadius: radii[28],
    paddingTop: space[12],
    paddingHorizontal: space[20],
    gap: space[14],
  },
  handle: {
    alignSelf: "center",
    width: HANDLE_WIDTH,
    height: HANDLE_HEIGHT,
    borderRadius: radii[4],
    backgroundColor: colors.borderStrong,
  },
  content: { gap: space[14] },
  title: { ...typography.titleS, color: colors.ink },
  subtitle: { ...typography.secondary, color: colors.muted },
  field: {
    ...typography.body,
    fontWeight: "500",
    color: colors.ink,
    backgroundColor: colors.note,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radii[16],
    padding: FIELD_PADDING,
    minHeight: FIELD_LINES * typography.body.lineHeight + FIELD_PADDING * 2,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space[8] },
  chip: {
    minHeight: CHIP_HEIGHT,
    paddingHorizontal: space[14],
    borderRadius: radii.full,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipOff: { borderColor: colors.line, backgroundColor: colors.surface },
  chipText: { ...typography.secondary, fontWeight: "600", color: colors.ink },
});
