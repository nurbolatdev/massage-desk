import { useRef, useState, type ComponentRef } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { TextField } from "@/components/TextField";
import { supabase } from "@/lib/auth/supabase";
import { signInErrorMessage, validateSignIn } from "@/lib/auth/signInErrors";
import { colors, space, typography } from "@/theme";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);

  function onEmailChange(text: string) {
    setEmail(text);
    setError(null);
  }

  function onPasswordChange(text: string) {
    setPassword(text);
    setError(null);
  }

  async function submit() {
    if (busy) {
      return;
    }
    const checked = validateSignIn(email, password);
    if (!checked.ok) {
      setError(checked.message);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: checked.email,
        password,
      });
      if (signInError) {
        setError(signInErrorMessage(signInError));
        setBusy(false);
      }
      // On success the route guard switches to the tabs; nothing else to do here.
    } catch (thrown) {
      setError(signInErrorMessage(thrown));
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <BrandLogo variant="inline" />
          <View style={styles.titleBlock}>
            <Text accessibilityRole="header" style={styles.title}>
              Вход
            </Text>
            <Text style={styles.lead}>Входить нужно один раз — дальше приложение открывается сразу.</Text>
          </View>
          <TextField
            label="Email"
            value={email}
            onChangeText={onEmailChange}
            editable={!busy}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <TextField
            ref={passwordRef}
            label="Пароль"
            value={password}
            onChangeText={onPasswordChange}
            editable={!busy}
            revealable
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
          />
          {error ? <ErrorBanner message={error} /> : null}
          <Button label={busy ? "Входим…" : "Войти"} onPress={submit} disabled={busy} />
          <Text style={styles.footer}>
            {"Регистрации нет — аккаунт создаёт Нурболат.\nЗабыли пароль? Напишите ему."}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingTop: space[56],
    paddingHorizontal: space[24],
    paddingBottom: space[24],
    gap: space[24],
  },
  titleBlock: { gap: space[6] },
  title: { ...typography.title, color: colors.ink },
  lead: { ...typography.body, color: colors.muted },
  footer: { ...typography.secondary, color: colors.muted, textAlign: "center", marginTop: "auto" },
});
