import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { cleanup, render } from "@testing-library/react-native";
import type { ReactNode } from "react";
import type { ViewStyle } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import TabsLayout from "@/app/(tabs)/_layout";

type ScreenOptions = {
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

  it("keeps the 72dp height when the bottom inset is 0", async () => {
    await renderTabs(0);

    expect(mockCaptured.screenOptions?.tabBarStyle).toEqual({
      height: 72,
      paddingBottom: 0,
      paddingTop: 6,
    });
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
      height: 120,
      paddingBottom: 48,
      paddingTop: 6,
    });
  });
});
