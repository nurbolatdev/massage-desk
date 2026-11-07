import { Stack } from "expo-router";
import { StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";

import { LaunchScreen } from "@/components/LaunchScreen";
import { SessionProvider, useSession } from "@/lib/auth/session";
import { QueryProvider } from "@/lib/query/QueryProvider";

function RootNavigator() {
  const { status } = useSession();

  // While loading both guards are false on purpose: nothing renders under the LaunchScreen overlay
  // (the dev warning "All routes in this navigator are protected" is expected).
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={status === "signedIn"}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="appointment/[id]" />
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
      <QueryProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </QueryProvider>
    </SessionProvider>
  );
}
