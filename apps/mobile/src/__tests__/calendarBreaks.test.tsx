import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { components } from "@massage-desk/api-types";
import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import CalendarScreen from "@/app/(tabs)/calendar";
import { queryKeys } from "@/lib/data/queryKeys";
import { breakText, freeTimeText } from "@/lib/data/todayState";

type Call = (path: string, init?: unknown) => Promise<unknown>;

const mockGet = jest.fn<Call>();
const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ canGoBack: () => true, back: jest.fn(), replace: jest.fn(), push: mockPush }),
  useIsFocused: () => true,
  useFocusEffect: () => undefined,
  useNavigation: () => ({ getState: () => undefined }),
}));

jest.mock("@/lib/time/useNow", () => ({
  // Wednesday 4 November 2026, 10:00 in Asia/Tashkent.
  useNow: () => new Date("2026-11-04T05:00:00Z"),
}));

jest.mock("@/lib/api", () => ({
  api: { GET: (path: string, init?: unknown) => mockGet(path, init) },
  unwrap: jest.requireActual<typeof import("@/lib/api/client")>("@/lib/api/client").unwrap,
  ApiError: jest.requireActual<typeof import("@/lib/api/errors")>("@/lib/api/errors").ApiError,
}));

type Schemas = components["schemas"];

const settings: Schemas["SettingsResponse"] = { timeZone: "Asia/Tashkent", botEnabled: true, address: null };

function item(id: string, name: string, start: string, end: string): Schemas["AppointmentListItem"] {
  return {
    id,
    clientId: `c-${id}`,
    clientName: name,
    clientPhone: "+998901234567",
    serviceId: "s1",
    serviceName: "Массаж спины",
    start,
    end,
    status: "confirmed",
    source: "bot",
  };
}

const appointments: Schemas["AppointmentListItem"][] = [
  item("m1", "Айгуль Сапарова", "2026-11-02T11:00:00+05:00", "2026-11-02T13:00:00+05:00"),
  item("m2", "Ержан Бекенов", "2026-11-02T14:00:00+05:00", "2026-11-02T15:00:00+05:00"),
  item("w1", "Светлана Петрова", "2026-11-04T10:30:00+05:00", "2026-11-04T11:30:00+05:00"),
  item("w2", "Марат Каримов", "2026-11-04T15:00:00+05:00", "2026-11-04T16:00:00+05:00"),
  item("f1", "Динара Алиева", "2026-11-06T11:00:00+05:00", "2026-11-06T13:00:00+05:00"),
  item("f2", "Тимур Саидов", "2026-11-06T14:00:00+05:00", "2026-11-06T15:00:00+05:00"),
];

const defaultBlocks = [1, 2, 3, 4, 5, 6, 7].flatMap((weekday) => [
  { weekday, start: "09:00", end: "13:00" },
  { weekday, start: "14:00", end: "19:00" },
]);

function ok(data: unknown) {
  return { data, response: new Response(null, { status: 200 }) };
}

function mockDay(blocks: unknown[] | "fail" = defaultBlocks) {
  const { ApiError } = jest.requireActual<typeof import("@/lib/api/errors")>("@/lib/api/errors");
  mockGet.mockImplementation(async (path) => {
    if (path === "/settings") return ok(settings);
    if (path === "/time-off") return ok([]);
    if (path === "/appointments") return ok(appointments);
    if (path === "/working-hours") {
      if (blocks === "fail") throw new ApiError("server", { status: 500 });
      return ok({ blocks });
    }
    throw new Error(`unexpected GET ${path}`);
  });
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
        <CalendarScreen />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

describe("calendar breaks", () => {
  beforeEach(() => {
    onlineManager.setOnline(true);
    mockGet.mockReset();
    mockPush.mockReset();
    mockDay();
  });

  afterEach(async () => {
    // Unmount before going back online, otherwise the mounted screen re-renders outside act().
    await cleanup();
    onlineManager.setOnline(true);
    queryClient.clear();
  });

  it("shows a break between two working blocks instead of free time", async () => {
    await renderScreen();

    expect(await screen.findByText(freeTimeText("13:00", 90))).toBeOnTheScreen();
    expect(screen.getByText(breakText("14:00"))).toBeOnTheScreen();
    expect(screen.getByText(freeTimeText("15:00", 60))).toBeOnTheScreen();
    expect(screen.queryByText(freeTimeText("15:00", 210))).toBeNull();
  });

  it("shows a break and no free time on a day with a break between the visits", async () => {
    const user = userEvent.setup();
    await renderScreen();

    await screen.findByText("Светлана Петрова");
    await user.press(await screen.findByLabelText("Пятница, 6 ноября, 2 записи"));

    expect(await screen.findByText("Динара Алиева")).toBeOnTheScreen();
    expect(screen.getByText(breakText("14:00"))).toBeOnTheScreen();
    expect(screen.queryByText(/^Свободно до/)).toBeNull();
  });

  it("names only real free time on the month card", async () => {
    const user = userEvent.setup();
    await renderScreen();

    await screen.findByText("Светлана Петрова");
    await user.press(screen.getByText("Месяц"));

    expect(await screen.findByLabelText(/Первая в 10:30, свободно 11:30–13:00/)).toBeOnTheScreen();
  });

  it("keeps saying Свободно весь день on an empty day", async () => {
    const user = userEvent.setup();
    await renderScreen();

    await screen.findByText("Светлана Петрова");
    await user.press(await screen.findByLabelText("Суббота, 7 ноября, Свободно"));

    expect(await screen.findByText("Свободно весь день")).toBeOnTheScreen();
  });

  it("shows no free or break rows on a past day", async () => {
    const user = userEvent.setup();
    await renderScreen();

    await screen.findByText("Светлана Петрова");
    await user.press(await screen.findByLabelText("Понедельник, 2 ноября, 2 записи"));

    expect(await screen.findByText("Айгуль Сапарова")).toBeOnTheScreen();
    expect(screen.queryByText(/^Перерыв/)).toBeNull();
    expect(screen.queryByText(/^Свободно до/)).toBeNull();
  });

  it("lists the clients without gap rows or errors when working hours fail", async () => {
    mockDay("fail");
    const user = userEvent.setup();
    await renderScreen();

    expect(await screen.findByText("Светлана Петрова")).toBeOnTheScreen();
    expect(screen.getByText("Марат Каримов")).toBeOnTheScreen();
    await waitFor(() => expect(queryClient.getQueryState(queryKeys.workingHours)?.status).toBe("error"));
    expect(screen.queryByText(/^Свободно до/)).toBeNull();
    expect(screen.queryByText(/^Перерыв/)).toBeNull();
    expect(screen.queryByText("Не получилось загрузить расписание. Попробуйте ещё раз.")).toBeNull();
    expect(screen.queryByText("Не получилось обновить расписание")).toBeNull();

    await user.press(await screen.findByLabelText(/Суббота, 7 ноября/));
    expect(await screen.findByText("Свободно весь день")).toBeOnTheScreen();
  });
});
