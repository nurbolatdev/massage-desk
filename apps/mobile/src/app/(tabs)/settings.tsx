import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { ConfirmSheet } from "@/components/ConfirmSheet";
import { PressableSurface, Surface } from "@/components/Surface";
import { TIME_OFF_SETTINGS_TITLE } from "@/lib/data/timeOffForm";
import { useSession } from "@/lib/auth/session";
import { colors, radii, space, typography } from "@/theme";

// from the Settings mockup
const ROW_MIN_HEIGHT = 70;
const ICON_TILE_SIZE = 42;
const ROW_ICON_SIZE = 22;
const CHEVRON_SIZE = 20;

const SIGN_OUT_FAILED = "Не получилось выйти. Проверьте интернет и попробуйте ещё раз.";

export default function SettingsScreen() {
  const router = useRouter();
  const { signOut } = useSession();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const close = () => {
    setOpen(false);
    setError(undefined);
  };

  const confirm = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const ok = await signOut();
      if (!ok) setError(SIGN_OUT_FAILED);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          Настройки
        </Text>
        <Surface style={styles.card}>
          <PressableSurface
            accessibilityRole="button"
            accessibilityLabel={TIME_OFF_SETTINGS_TITLE}
            onPress={() => router.push("/time-off/new")}
            style={styles.row}
          >
            <View style={styles.tile}>
              <Feather name="calendar" size={ROW_ICON_SIZE} color={colors.primaryStrong} accessible={false} />
            </View>
            <Text style={styles.rowTitle}>{TIME_OFF_SETTINGS_TITLE}</Text>
            <Feather name="chevron-right" size={CHEVRON_SIZE} color={colors.muted} accessible={false} />
          </PressableSurface>
        </Surface>
      </View>
      <View style={styles.footer}>
        <Button label="Выйти из аккаунта" variant="outline" onPress={() => setOpen(true)} />
      </View>
      <ConfirmSheet
        visible={open}
        title="Выйти из аккаунта?"
        text="Чтобы снова войти, понадобятся email и пароль. Если не помните — их знает Нурболат."
        confirmLabel="Да, выйти"
        onConfirm={() => void confirm()}
        onCancel={close}
        busy={busy}
        error={error}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, paddingTop: space[24], paddingHorizontal: space[16], gap: space[16] },
  title: { ...typography.title, letterSpacing: -0.5, color: colors.ink, paddingHorizontal: space[4] },
  card: { borderRadius: radii[22], overflow: "hidden" },
  row: {
    minHeight: ROW_MIN_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: space[14],
    paddingVertical: space[12],
    paddingHorizontal: space[16],
  },
  tile: {
    width: ICON_TILE_SIZE,
    height: ICON_TILE_SIZE,
    borderRadius: radii[12],
    backgroundColor: colors.segmentBg,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { ...typography.body, fontWeight: "700", color: colors.ink, flex: 1 },
  footer: { padding: space[16] },
});
