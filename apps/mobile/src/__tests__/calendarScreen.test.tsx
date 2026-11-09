import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { components } from "@massage-desk/api-types";
import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import CalendarScreen from "@/app/(tabs)/calendar";

type Call = (path: string, init?: unknown) => Promise<unknown>;

const mockGet = jest.fn<Call>();
const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ canGoBack: () => true, back: jest.fn(), replace: jest.fn(), push: mockPush }),
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

function item(
  id: string,
  name: string,
  start: string,
  end: string,
  status: Schemas["AppointmentListItem"]["status"] = "confirmed",
): Schemas["AppointmentListItem"] {
  return {
    id,
    clientId: `c-${id}`,
    clientName: name,
    clientPhone: "+998901234567",
    serviceId: "s1",
    serviceName: "Массаж спины",
    start,
    end,
    status,
    source: "bot",
  };
}

const week: Schemas["AppointmentListItem"][] = [
  item("m1", "Айгуль Сапарова", "2026-11-02T10:00:00+05:00", "2026-11-02T11:00:00+05:00"),
  item("m2", "Ержан Бекенов", "2026-11-02T11:30:00+05:00", "2026-11-02T13:00:00+05:00"),
  item("m3", "Отменённая Клиентка", "2026-11-02T15:00:00+05:00", "2026-11-02T16:00:00+05:00", "cancelled"),
  item("w1", "Светлана Петрова", "2026-11-04T14:00:00+05:00", "2026-11-04T15:00:00+05:00"),
  item("w2", "Марат Каримов", "2026-11-04T16:00:00+05:00", "2026-11-04T17:00:00+05:00"),
];

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
        <CalendarScreen />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

function appointmentCalls() {
  return mockGet.mock.calls.filter(([path]) => path === "/appointments").map(([, init]) => init);
}

describe("calendar screen", () => {
  beforeEach(() => {
    onlineManager.setOnline(true);
    mockGet.mockReset();
    mockPush.mockReset();
    mockGet.mockImplementation(async (path, init) => {
      if (path === "/settings") return ok(settings);
      if (path === "/appointments") {
        const query = (init as { params: { query: { from: string } } }).params.query;
        return ok(query.from === "2026-11-02" ? week : []);
      }
      throw new Error(`unexpected GET ${path}`);
    });
  });

  afterEach(() => {
    onlineManager.setOnline(true);
    queryClient.clear();
  });

  it("opens on the current week with today picked", async () => {
    await renderScreen();

    expect(await screen.findByText("Среда, 4 ноября")).toBeTruthy();
    expect(screen.getByText("Ноябрь")).toBeTruthy();
    expect(screen.getByText("2–8 ноября")).toBeTruthy();
    expect(appointmentCalls()).toContainEqual({ params: { query: { from: "2026-11-02", to: "2026-11-08" } } });
    const cell = await screen.findByLabelText("Среда, 4 ноября, 2 записи");
    expect(cell.props.accessibilityState).toMatchObject({ selected: true });
  });

  it("counts shown appointments and skips cancelled ones", async () => {
    await renderScreen();

    expect(await screen.findByLabelText("Понедельник, 2 ноября, 2 записи")).toBeTruthy();
    expect(screen.queryByText("Отменённая Клиентка")).toBeNull();
  });

  it("tapping a day shows its appointments", async () => {
    const user = userEvent.setup();
    await renderScreen();

    await screen.findByText("Светлана Петрова");
    await user.press(await screen.findByLabelText("Понедельник, 2 ноября, 2 записи"));

    expect(await screen.findByText("Понедельник, 2 ноября")).toBeTruthy();
    expect(screen.getByText("Айгуль Сапарова")).toBeTruthy();
    expect(screen.getByText("Ержан Бекенов")).toBeTruthy();
    expect(screen.queryByText("Светлана Петрова")).toBeNull();
  });

  it("shows a free gap and opens the appointment card", async () => {
    const user = userEvent.setup();
    await renderScreen();

    expect(await screen.findByText(/Свободно до 16:00/)).toBeTruthy();
    await user.press(screen.getByText("Марат Каримов"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/appointment/[id]",
      params: { id: "w2", day: "2026-11-04" },
    });
  });

  it("moves to the next week", async () => {
    const user = userEvent.setup();
    await renderScreen();

    await screen.findByText("Светлана Петрова");
    await user.press(screen.getByLabelText("Следующая неделя"));

    expect(await screen.findByText("Среда, 11 ноября")).toBeTruthy();
    expect(screen.getByText("9–15 ноября")).toBeTruthy();
    await waitFor(() =>
      expect(appointmentCalls()).toContainEqual({ params: { query: { from: "2026-11-09", to: "2026-11-15" } } }),
    );
  });

  it("shows a text card for a day without appointments", async () => {
    const user = userEvent.setup();
    await renderScreen();

    await screen.findByText("Светлана Петрова");
    await user.press(screen.getByLabelText("Следующая неделя"));

    expect(await screen.findByText("На этот день записей нет")).toBeTruthy();
    expect(screen.getByText("Свободно")).toBeTruthy();
  });

  it("shows the load error with a retry button", async () => {
    const { ApiError } = jest.requireActual<typeof import("@/lib/api/errors")>("@/lib/api/errors");
    mockGet.mockImplementation(async (path) => {
      if (path === "/settings") return ok(settings);
      throw new ApiError("server", { status: 500 });
    });
    await renderScreen();

    expect(await screen.findByText("Не получилось загрузить расписание. Попробуйте ещё раз.")).toBeTruthy();
    expect(screen.getByText("Обновить")).toBeTruthy();
  });

  it("shows the offline message when there is no saved schedule", async () => {
    onlineManager.setOnline(false);
    await renderScreen();

    expect(await screen.findByText("Расписание появится, когда телефон подключится к интернету.")).toBeTruthy();
  });
});
