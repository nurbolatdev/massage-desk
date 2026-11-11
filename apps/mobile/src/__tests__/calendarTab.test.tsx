import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { components } from "@massage-desk/api-types";
import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import CalendarScreen from "@/app/(tabs)/calendar";
import { CANCEL_CONFIRM_YES } from "@/lib/data/appointmentCard";
import {
  clearBookingNotice,
  getBookingNotice,
  noticeText,
  showBookingNotice,
} from "@/lib/data/bookingNotice";
import { queryKeys } from "@/lib/data/queryKeys";

type Call = (path: string, init?: unknown) => Promise<unknown>;

const mockGet = jest.fn<Call>();
const mockPost = jest.fn<Call>();
const mockPush = jest.fn();

const mockFocus: { effect: (() => void | (() => void)) | null; tab: string } = { effect: null, tab: "calendar" };

jest.mock("expo-router", () => ({
  useRouter: () => ({ canGoBack: () => true, back: jest.fn(), replace: jest.fn(), push: mockPush }),
  useIsFocused: () => true,
  useNavigation: () => ({ getState: () => ({ index: 0, routes: [{ key: "t", name: mockFocus.tab }] }) }),
  useFocusEffect: (effect: () => void | (() => void)) => {
    mockFocus.effect = effect;
  },
}));

jest.mock("@/lib/time/useNow", () => ({
  // Wednesday 4 November 2026, 10:00 in Asia/Tashkent.
  useNow: () => new Date("2026-11-04T05:00:00Z"),
}));

jest.mock("@/lib/api", () => ({
  api: {
    GET: (path: string, init?: unknown) => mockGet(path, init),
    POST: (path: string, init?: unknown) => mockPost(path, init),
  },
  unwrap: jest.requireActual<typeof import("@/lib/api/client")>("@/lib/api/client").unwrap,
  ApiError: jest.requireActual<typeof import("@/lib/api/errors")>("@/lib/api/errors").ApiError,
}));

type Schemas = components["schemas"];

const settings: Schemas["SettingsResponse"] = { timeZone: "Asia/Tashkent", botEnabled: true, address: null };

const cancelled: Schemas["AppointmentResponse"] = {
  id: "n1",
  clientId: "c1",
  serviceId: "s1",
  start: "2026-11-05T15:00:00+05:00",
  end: "2026-11-05T16:00:00+05:00",
  status: "cancelled",
  source: "bot",
};

const notice = {
  appointmentId: "n1",
  clientName: "Айгуль Сапарова",
  start: new Date("2026-11-05T15:00:00+05:00"),
};

function ok(data: unknown) {
  return { data, response: new Response(null, { status: 200 }) };
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
});

// Focus then blur of the calendar tab while the tabs show `tab`.
async function leave(tab: string) {
  mockFocus.tab = tab;
  await act(async () => {
    const cleanupEffect = mockFocus.effect?.();
    if (typeof cleanupEffect === "function") cleanupEffect();
  });
}

function renderScreen() {
  return render(
    <SafeAreaProvider
      initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}
    >
      <QueryClientProvider client={queryClient}>
        <CalendarScreen />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

describe("calendar tab", () => {
  beforeEach(() => {
    onlineManager.setOnline(true);
    mockFocus.effect = null;
    mockFocus.tab = "calendar";
    mockGet.mockReset();
    mockPost.mockReset();
    mockPush.mockReset();
    mockGet.mockImplementation(async (path) => {
      if (path === "/settings") return ok(settings);
      if (path === "/appointments" || path === "/time-off") return ok([]);
      throw new Error(`unexpected GET ${path}`);
    });
    mockPost.mockResolvedValue(ok(cancelled));
  });

  afterEach(async () => {
    await cleanup();
    clearBookingNotice();
    onlineManager.setOnline(true);
    queryClient.clear();
  });

  it("shows the booking notice", async () => {
    showBookingNotice(notice);
    await renderScreen();

    expect(await screen.findByText("Записано")).toBeTruthy();
    expect(screen.getByText(noticeText(notice, "Asia/Tashkent"))).toBeTruthy();
  });

  it("cancels the booking from the notice after confirming", async () => {
    showBookingNotice(notice);
    await renderScreen();
    const user = userEvent.setup();

    await user.press(await screen.findByText("Отменить"));
    expect(mockPost).not.toHaveBeenCalled();
    await user.press(await screen.findByText(CANCEL_CONFIRM_YES));

    await waitFor(() => expect(screen.queryByText("Записано")).toBeNull());
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith("/appointments/{id}/cancel", { params: { path: { id: "n1" } } });
  });

  it("disables the cancel button offline", async () => {
    queryClient.setQueryData(queryKeys.settings, settings);
    queryClient.setQueryData(queryKeys.appointments.range("2026-11-02", "2026-11-08"), []);
    queryClient.setQueryData(queryKeys.timeOff.range("2026-11-02", "2026-11-08"), []);
    onlineManager.setOnline(false);
    showBookingNotice(notice);
    await renderScreen();

    const button = await screen.findByRole("button", { name: "Отменить" });
    expect(button.props.accessibilityState).toMatchObject({ disabled: true });
  });

  it("clears the notice when booking from the calendar", async () => {
    showBookingNotice(notice);
    await renderScreen();
    const user = userEvent.setup();

    await user.press(await screen.findByText("Записать на ср, 4 ноября"));

    expect(getBookingNotice()).toBeNull();
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/new-appointment", params: { day: "2026-11-04" } });
  });

  it("opens on today after another tab", async () => {
    const user = userEvent.setup();
    await renderScreen();

    await user.press(await screen.findByLabelText("Следующая неделя"));
    expect(await screen.findByText("Среда, 11 ноября")).toBeTruthy();
    await leave("index");

    expect(await screen.findByText("Среда, 4 ноября")).toBeTruthy();
    expect(screen.getByText("2–8 ноября")).toBeTruthy();
    expect((await screen.findByLabelText(/^Среда, 4 ноября/)).props.accessibilityState).toMatchObject({
      selected: true,
    });
  });

  it("keeps the picked day when a card is opened on top", async () => {
    const user = userEvent.setup();
    await renderScreen();

    await user.press(await screen.findByLabelText("Следующая неделя"));
    expect(await screen.findByText("Среда, 11 ноября")).toBeTruthy();
    await leave("calendar");

    expect(screen.getByText("Среда, 11 ноября")).toBeTruthy();
  });

  it("keeps the month view and opens on the current month", async () => {
    const user = userEvent.setup();
    await renderScreen();

    await user.press(await screen.findByText("Месяц"));
    await user.press(await screen.findByLabelText("Следующий месяц"));
    expect(await screen.findByText("1–31 декабря")).toBeTruthy();
    await leave("settings");

    expect(await screen.findByText("1–30 ноября")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Месяц" }).props.accessibilityState).toMatchObject({ selected: true });
  });
});
