import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { cleanup, render } from "@testing-library/react-native";
import type { ReactNode } from "react";
import type { TextStyle, ViewStyle } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import TabsLayout from "@/app/(tabs)/_layout";
import { typography } from "@/theme";

type ScreenOptions = {
  tabBarLabelStyle?: TextStyle;
  tabBarStyle?: ViewStyle;
};

type TabsProps = {
  screenOptions?: ScreenOptions;
  children?: ReactNode;
};

type ScreenProps = {
  name: string;
  options?: { title?: string };
};

const mockCaptured: {
  screenOptions?: ScreenOptions;
  screens: ScreenProps[];
} = {
  screens: [],
};

jest.mock("expo-router", () => {
  function MockTabs({ screenOptions, children }: TabsProps) {
    mockCaptured.screenOptions = screenOptions;
    return children ?? null;
  }
  function MockScreen(props: ScreenProps) {
    mockCaptured.screens.push(props);
    return null;
  }
  MockTabs.Screen = MockScreen;
  return { Tabs: MockTabs };
});

function renderTabs(bottomInset: number) {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: bottomInset },
      }}
    >
      <TabsLayout />
    </SafeAreaProvider>,
  );
}

describe("tabs layout", () => {
  afterEach(async () => {
    mockCaptured.screenOptions = undefined;
    mockCaptured.screens = [];
    await cleanup();
  });

  it("keeps the 78dp height and theme label style when the bottom inset is 0", async () => {
    await renderTabs(0);

    expect(mockCaptured.screenOptions?.tabBarStyle).toEqual({
      height: 78,
      paddingBottom: 0,
      paddingTop: 6,
    });
    expect(mockCaptured.screenOptions?.tabBarLabelStyle).toEqual(typography.label);
    expect(mockCaptured.screens.map((s) => s.options?.title)).toEqual([
      "Сегодня",
      "Календарь",
      "Чаты",
      "Настройки",
    ]);
  });

  it("adds the bottom system inset to the tab bar height and bottom padding", async () => {
    await renderTabs(48);

    expect(mockCaptured.screenOptions?.tabBarStyle).toEqual({
      height: 126,
      paddingBottom: 48,
      paddingTop: 6,
    });
  });
});
