import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";
import { colors, fontSize } from "@/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

function icon(name: IconName) {
  return function TabIcon({ color }: { color: ColorValue }) {
    // Tint colors come from the theme as strings; anything else falls back to the default.
    return <Ionicons name={name} size={28} color={typeof color === "string" ? color : colors.textMuted} />;
  };
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 14, fontWeight: "600" },
        tabBarStyle: { height: 72, paddingTop: 6 },
        headerTitleStyle: { fontSize: fontSize.title },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Сегодня", headerShown: false, tabBarIcon: icon("today-outline") }} />
      <Tabs.Screen name="calendar" options={{ title: "Календарь", tabBarIcon: icon("calendar-outline") }} />
      <Tabs.Screen name="chats" options={{ title: "Чаты", tabBarIcon: icon("chatbubbles-outline") }} />
      <Tabs.Screen name="settings" options={{ title: "Настройки", tabBarIcon: icon("settings-outline") }} />
    </Tabs>
  );
}
