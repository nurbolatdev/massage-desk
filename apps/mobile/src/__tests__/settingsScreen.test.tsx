import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { cleanup, render, screen, userEvent } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import SettingsScreen from "@/app/(tabs)/settings";

const mockPush = jest.fn();
const mockSignOut = jest.fn<() => Promise<boolean>>();

jest.mock("expo-router", () => ({
  useRouter: () => ({ canGoBack: () => true, back: jest.fn(), replace: jest.fn(), push: mockPush }),
}));

jest.mock("@/lib/auth/session", () => ({
  useSession: () => ({ signOut: mockSignOut }),
}));

function renderScreen() {
  return render(
    <SafeAreaProvider
      initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}
    >
      <SettingsScreen />
    </SafeAreaProvider>,
  );
}

describe("settings screen", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockSignOut.mockReset();
  });

  afterEach(async () => {
    await cleanup();
  });

  it("opens the days off screen from the row", async () => {
    const user = userEvent.setup();
    await renderScreen();

    expect(screen.getByText("Настройки")).toBeTruthy();
    await user.press(screen.getByRole("button", { name: "Выходные и отпуск" }));

    expect(mockPush).toHaveBeenCalledWith("/time-off");
  });

  it("still asks before signing out", async () => {
    const user = userEvent.setup();
    await renderScreen();

    await user.press(screen.getByRole("button", { name: "Выйти из аккаунта" }));

    expect(await screen.findByText("Выйти из аккаунта?")).toBeTruthy();
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});
