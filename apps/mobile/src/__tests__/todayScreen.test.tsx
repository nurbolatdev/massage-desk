import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import TodayScreen from "@/app/(tabs)/index";

type Call = (path: string, init?: unknown) => Promise<unknown>;

const mockGet = jest.fn<Call>();

jest.mock("expo-router", () => ({
  useRouter: () => ({ canGoBack: () => true, back: jest.fn(), replace: jest.fn(), push: jest.fn() }),
}));

jest.mock("@/lib/time/useNow", () => ({
  useNow: () => new Date("2026-11-04T05:00:00Z"),
}));

jest.mock("@/lib/api", () => ({
  api: { GET: (path: string, init?: unknown) => mockGet(path, init) },
  unwrap: jest.requireActual<typeof import("@/lib/api/client")>("@/lib/api/client").unwrap,
  ApiError: jest.requireActual<typeof import("@/lib/api/errors")>("@/lib/api/errors").ApiError,
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
});

function renderScreen() {
  return render(
    <SafeAreaProvider
      initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}
    >
      <QueryClientProvider client={queryClient}>
        <TodayScreen />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

describe("today screen", () => {
  beforeEach(() => {
    onlineManager.setOnline(true);
    mockGet.mockReset();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("does not request appointments on refresh while settings are failing", async () => {
    const { ApiError } = jest.requireActual<typeof import("@/lib/api/errors")>("@/lib/api/errors");
    const user = userEvent.setup();
    mockGet.mockImplementation(async (path) => {
      if (path === "/settings") throw new ApiError("server", { status: 500 });
      throw new Error(`unexpected GET ${path}`);
    });
    await renderScreen();

    await user.press(await screen.findByText("Обновить"));

    await waitFor(() => expect(mockGet.mock.calls.filter(([path]) => path === "/settings")).toHaveLength(2));
    expect(mockGet.mock.calls.filter(([path]) => path === "/appointments")).toHaveLength(0);
  });
});
