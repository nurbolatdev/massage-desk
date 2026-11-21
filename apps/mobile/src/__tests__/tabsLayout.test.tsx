import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { cleanup, render, screen } from "@testing-library/react-native";
import type { ReactElement, ReactNode } from "react";
import type { ViewStyle } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import TabsLayout from "@/app/(tabs)/_layout";
import { colors, typography } from "@/theme";

type LabelProps = { children: string; color: string; focused: boolean };

type ScreenOptions = {
  tabBarActiveTintColor?: string;
  tabBarInactiveTintColor?: string;
  tabBarLabel?: (props: LabelProps) => ReactElement;
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
      backgroundColor: colors.surface,
      borderTopColor: colors.line,
      borderTopWidth: 1,
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
      height: 126,
      paddingBottom: 48,
      paddingTop: 6,
      backgroundColor: colors.surface,
      borderTopColor: colors.line,
      borderTopWidth: 1,
    });
  });

  it("uses design-system colours for the tabs and the top border", async () => {
    await renderTabs(0);

    expect(mockCaptured.screenOptions?.tabBarActiveTintColor).toBe(colors.primaryStrong);
    expect(mockCaptured.screenOptions?.tabBarInactiveTintColor).toBe(colors.muted);
    expect(mockCaptured.screenOptions?.tabBarStyle?.borderTopColor).toBe(colors.line);
  });

  // Jest does not measure layout: these checks cover the settings that keep the labels
  // whole at a 130% system font, not the pixel result.
  it("sets labels to one line that shrinks to fit instead of being cut", async () => {
    await renderTabs(0);

    const label = mockCaptured.screenOptions?.tabBarLabel;
    expect(label).toBeDefined();
    await render(label?.({ children: "Календарь", color: colors.muted, focused: false }) ?? <></>);

    const text = screen.getByText("Календарь");
    expect(text.props.numberOfLines).toBe(1);
    expect(text.props.adjustsFontSizeToFit).toBe(true);
    // Only checks that the (iOS) setting is present; it is not a size guarantee.
    expect(text.props.minimumFontScale).toBeGreaterThanOrEqual(0.77);
    expect(text.props.style).toEqual([typography.label, { color: colors.muted }]);
  });
});
