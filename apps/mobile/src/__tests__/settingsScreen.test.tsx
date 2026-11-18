import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, userEvent } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import SettingsScreen from "@/app/(tabs)/settings";

const mockPush = jest.fn();
const mockSignOut = jest.fn<() => Promise<boolean>>();
const mockGet = jest.fn<(path: string, init?: unknown) => Promise<unknown>>();

jest.mock("@/lib/time/useNow", () => ({
  // Wednesday 4 November 2026, 10:00 in Asia/Almaty (UTC+5).
  useNow: () => new Date("2026-11-04T05:00:00Z"),
}));

jest.mock("@/lib/api", () => ({
  api: { GET: (path: string, init?: unknown) => mockGet(path, init) },
  unwrap: jest.requireActual<typeof import("@/lib/api/client")>("@/lib/api/client").unwrap,
  ApiError: jest.requireActual<typeof import("@/lib/api/errors")>("@/lib/api/errors").ApiError,
}));

const settings = { timeZone: "Asia/Almaty", botEnabled: true, address: null };
const vacation = { id: "t1", start: "2026-12-14T19:00:00Z", end: "2026-12-22T19:00:00Z", reason: null };
const dayOff = { id: "t2", start: "2026-12-30T19:00:00Z", end: "2026-12-31T19:00:00Z", reason: null };

function ok(data: unknown) {
  return { data, response: new Response(null, { status: 200 }) };
}

function answer(items: unknown[]) {
  mockGet.mockImplementation(async (path, init) => {
    if (path === "/settings") return ok(settings);
    if (path === "/time-off") {
      const from = (init as { params: { query: { from: string } } }).params.query.from;
      return ok(from === "2026-11-04" ? items : []);
    }
    throw new Error(`unexpected GET ${path}`);
  });
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, gcTime: Infinity } },
});

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
      <QueryClientProvider client={queryClient}>
        <SettingsScreen />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

describe("settings screen", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockSignOut.mockReset();
    mockGet.mockReset();
    onlineManager.setOnline(true);
    answer([]);
  });

  afterEach(async () => {
    await cleanup();
    onlineManager.setOnline(true);
    queryClient.clear();
  });

  it("opens the days off screen from the row", async () => {
    const user = userEvent.setup();
    await renderScreen();

    expect(screen.getByText("Настройки")).toBeTruthy();
    await user.press(screen.getByRole("button", { name: /^Выходные и отпуск/ }));

    expect(mockPush).toHaveBeenCalledWith("/time-off");
  });

  it("says that no days off are set", async () => {
    await renderScreen();

    expect(await screen.findByText("Отпуск не задан")).toBeTruthy();
  });

  it("shows the nearest period and how many more follow", async () => {
    answer([dayOff, vacation]);
    await renderScreen();

    expect(await screen.findByText("Отпуск · 15 – 22 декабря и ещё 1")).toBeTruthy();
  });

  it("shows no second line while settings are loading, and the row still works", async () => {
    mockGet.mockImplementation(() => new Promise(() => undefined));
    const user = userEvent.setup();
    await renderScreen();

    expect(screen.queryByText(/Отпуск/)).toBeNull();
    await user.press(screen.getByRole("button", { name: /^Выходные и отпуск/ }));
    expect(mockPush).toHaveBeenCalledWith("/time-off");
  });

  it("shows no second line and no error when the request fails", async () => {
    mockGet.mockImplementation(async (path) => {
      if (path === "/settings") return ok(settings);
      return { error: { code: "INTERNAL" }, response: new Response(null, { status: 500 }) };
    });
    await renderScreen();

    await screen.findByText("Настройки");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText(/Отпуск/)).toBeNull();
    expect(screen.queryByText(/Не получилось/)).toBeNull();
  });

  it("shows no second line offline without saved data", async () => {
    onlineManager.setOnline(false);
    await renderScreen();

    expect(screen.queryByText(/Отпуск/)).toBeNull();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("still asks before signing out", async () => {
    const user = userEvent.setup();
    await renderScreen();

    await user.press(screen.getByRole("button", { name: "Выйти из аккаунта" }));

    expect(await screen.findByText("Выйти из аккаунта?")).toBeTruthy();
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});
