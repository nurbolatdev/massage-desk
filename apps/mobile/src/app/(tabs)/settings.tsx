import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/Button";
import { ConfirmSheet } from "@/components/ConfirmSheet";
import { Placeholder } from "@/components/Placeholder";
import { useSession } from "@/lib/auth/session";
import { colors, space } from "@/theme";

const SIGN_OUT_FAILED = "Не получилось выйти. Проверьте интернет и попробуйте ещё раз.";

export default function SettingsScreen() {
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
    <View style={styles.screen}>
      <Placeholder title="Настройки" text="Здесь будут часы работы, услуги и цены." />
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  footer: { padding: space[16] },
});
