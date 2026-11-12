import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import TodayScreen from "@/app/(tabs)/index";
import { NOTICE_MS, clearBookingNotice, getBookingNotice, noticeText, showBookingNotice } from "@/lib/data/bookingNotice";
import { EMPTY_TITLE } from "@/lib/data/todayState";

type Call = (path: string, init?: unknown) => Promise<unknown>;

const mockGet = jest.fn<Call>();
const mockPush = jest.fn();
let mockFocused = true;

jest.mock("expo-router", () => ({
  useRouter: () => ({ canGoBack: () => true, back: jest.fn(), replace: jest.fn(), push: mockPush }),
  useIsFocused: () => mockFocused,
}));

jest.mock("@/lib/time/useNow", () => ({
  useNow: () => new Date("2026-11-04T05:00:00Z"),
}));

jest.mock("@/lib/api", () => ({
  api: { GET: (path: string, init?: unknown) => mockGet(path, init) },
  unwrap: jest.requireActual<typeof import("@/lib/api/client")>("@/lib/api/client").unwrap,
  ApiError: jest.requireActual<typeof import("@/lib/api/errors")>("@/lib/api/errors").ApiError,
}));

function ok(data: unknown) {
  return { data, response: new Response(null, { status: 200 }) };
}

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
    mockPush.mockReset();
    mockFocused = true;
  });

  afterEach(async () => {
    await cleanup();
    clearBookingNotice();
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
    expect(mockGet.mock.calls.filter(([path]) => path === "/working-hours")).toHaveLength(0);
  });

  describe("booking notice", () => {
    const notice = { appointmentId: "n1", clientName: "Айгуль Сапарова", start: new Date("2026-11-05T15:00:00+05:00") };

    beforeEach(() => {
      mockGet.mockImplementation(async (path) => {
        if (path === "/settings") return ok({ timeZone: "Asia/Tashkent", botEnabled: true, address: null });
        if (path === "/appointments") return ok([]);
        if (path === "/working-hours") return ok({ blocks: [] });
        throw new Error(`unexpected GET ${path}`);
      });
    });

    it("shows the notice with an enabled cancel button", async () => {
      showBookingNotice(notice);
      await renderScreen();

      expect(await screen.findByText("Записано")).toBeOnTheScreen();
      expect(screen.getByText(noticeText(notice, "Asia/Tashkent"))).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Отменить" })).toBeEnabled();
    });

    it("shows nothing while the tab is not focused", async () => {
      mockFocused = false;
      showBookingNotice(notice);
      await renderScreen();

      expect(await screen.findByText(EMPTY_TITLE)).toBeOnTheScreen();
      expect(screen.queryByText("Записано")).toBeNull();
    });

    it("does not bring the notice back after its time ran out in a hidden tab", async () => {
      const realNow = Date.now();
      showBookingNotice(notice);
      mockFocused = false;
      const view = await renderScreen();
      expect(await screen.findByText(EMPTY_TITLE)).toBeOnTheScreen();

      const clock = jest.spyOn(Date, "now").mockReturnValue(realNow + NOTICE_MS + 1000);
      try {
        mockFocused = true;
        await act(async () => {
          view.rerender(
            <SafeAreaProvider
              initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}
            >
              <QueryClientProvider client={queryClient}>
                <TodayScreen />
              </QueryClientProvider>
            </SafeAreaProvider>,
          );
        });
        expect(screen.queryByText("Записано")).toBeNull();
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 20));
        });

        expect(getBookingNotice()).toBeNull();
        expect(screen.queryByText("Записано")).toBeNull();
      } finally {
        clock.mockRestore();
      }
    });

    it("clears the notice when booking a client", async () => {
      const user = userEvent.setup();
      showBookingNotice(notice);
      await renderScreen();

      await user.press(await screen.findByText("Записать клиента"));

      expect(getBookingNotice()).toBeNull();
      expect(mockPush).toHaveBeenCalledWith("/new-appointment");
    });
  });
});
