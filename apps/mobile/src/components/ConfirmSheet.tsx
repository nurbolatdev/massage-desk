import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { colors, radii, space, typography } from "@/theme";

type Props = {
  visible: boolean;
  title: string;
  text: string;
  confirmLabel: string;
  cancelLabel?: string;
  confirmVariant?: "primary" | "danger";
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  error?: string;
};

export function ConfirmSheet({
  visible,
  title,
  text,
  confirmLabel,
  cancelLabel = "Нет, оставить",
  confirmVariant = "primary",
  confirmDisabled = false,
  onConfirm,
  onCancel,
  busy = false,
  error,
}: Props) {
  const insets = useSafeAreaInsets();
  const cancel = () => {
    if (!busy) onCancel();
  };

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={cancel} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable
          accessibilityLabel={cancelLabel}
          accessibilityRole="button"
          disabled={busy}
          onPress={cancel}
          style={styles.scrim}
        />
        <View style={[styles.sheet, { paddingBottom: space[28] + insets.bottom }]}>
          <ScrollView bounces={false} contentContainerStyle={styles.content}>
            <Text accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
            <Text style={styles.text}>{text}</Text>
            {error ? <ErrorBanner message={error} /> : null}
            <Button label={confirmLabel} onPress={onConfirm} variant={confirmVariant} disabled={busy || confirmDisabled} />
            <Button label={cancelLabel} onPress={cancel} variant="soft" disabled={busy} />
          </ScrollView>
        </View>
      </View>
    </Modal>
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
    paddingTop: space[24],
    paddingHorizontal: space[20],
  },
  content: { gap: space[14] },
  title: { ...typography.titleS, color: colors.ink },
  text: { ...typography.body, color: colors.textStrong },
});
