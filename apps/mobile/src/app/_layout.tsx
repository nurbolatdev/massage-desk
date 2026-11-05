import { Stack } from "expo-router";
import { StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";

import { LaunchScreen } from "@/components/LaunchScreen";
import { SessionProvider, useSession } from "@/lib/auth/session";

function RootNavigator() {
  const { status } = useSession();

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={status === "signedIn"}>
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
        <Stack.Protected guard={status === "signedOut"}>
          <Stack.Screen name="login" />
        </Stack.Protected>
      </Stack>
      {status === "loading" ? (
        <View style={StyleSheet.absoluteFill}>
          <LaunchScreen />
        </View>
      ) : null}
    </>
  );
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="dark" />
      <RootNavigator />
    </SessionProvider>
  );
}
