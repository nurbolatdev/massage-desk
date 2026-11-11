import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { components } from "@massage-desk/api-types";
import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import CalendarScreen from "@/app/(tabs)/calendar";

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
        return ok(query.from === "2026-11-02" || query.from === "2026-11-01" ? week : []);
      }
      if (path === "/time-off") return ok([]);
      throw new Error(`unexpected GET ${path}`);
    });
  });

  afterEach(async () => {
    // Unmount before going back online, otherwise the mounted screen re-renders outside act().
    await cleanup();
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

  it("does not say Свободно while the week is loading", async () => {
    mockGet.mockImplementation(async (path) => {
      if (path === "/settings") return ok(settings);
      return new Promise(() => {});
    });
    await renderScreen();

    expect(await screen.findByLabelText("Среда, 4 ноября")).toBeTruthy();
    expect(screen.queryByLabelText("Среда, 4 ноября, Свободно")).toBeNull();
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

    expect(await screen.findByText("Свободно весь день")).toBeTruthy();
    expect(screen.getByText("Свободно")).toBeTruthy();
  });

  it("keeps the text card for a past empty day", async () => {
    const user = userEvent.setup();
    await renderScreen();

    await screen.findByText("Светлана Петрова");
    await user.press(screen.getByLabelText("Прошлая неделя"));

    expect(await screen.findByText("На этот день записей нет")).toBeTruthy();
    expect(screen.queryByText("Свободно весь день")).toBeNull();
  });

  it("books for the picked day", async () => {
    const user = userEvent.setup();
    await renderScreen();

    await user.press(await screen.findByRole("button", { name: "Записать на ср, 4 ноября" }));

    expect(mockPush).toHaveBeenCalledWith({ pathname: "/new-appointment", params: { day: "2026-11-04" } });
  });

  it("books without a day for a past day", async () => {
    const user = userEvent.setup();
    await renderScreen();

    await screen.findByText("Светлана Петрова");
    await user.press(screen.getByLabelText("Прошлая неделя"));
    await screen.findByText("На этот день записей нет");
    await user.press(screen.getByRole("button", { name: "Записать клиента" }));

    expect(mockPush).toHaveBeenCalledWith("/new-appointment");
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
    expect(appointmentCalls()).toHaveLength(0);
  });

  it("requests appointments again on refresh when the dates are known", async () => {
    const { ApiError } = jest.requireActual<typeof import("@/lib/api/errors")>("@/lib/api/errors");
    const user = userEvent.setup();
    mockGet.mockImplementation(async (path) => {
      if (path === "/settings") return ok(settings);
      throw new ApiError("server", { status: 500 });
    });
    await renderScreen();

    await user.press(await screen.findByText("Обновить"));

    await waitFor(() => expect(appointmentCalls()).toHaveLength(2));
    expect(appointmentCalls()[1]).toEqual({ params: { query: { from: "2026-11-02", to: "2026-11-08" } } });
  });

  it("shows the offline message when there is no saved schedule", async () => {
    onlineManager.setOnline(false);
    await renderScreen();

    expect(await screen.findByText("Расписание появится, когда телефон подключится к интернету.")).toBeTruthy();
  });

  it("switches to the month", async () => {
    const user = userEvent.setup();
    await renderScreen();

    await screen.findByText("Светлана Петрова");
    await user.press(screen.getByText("Месяц"));

    expect(await screen.findByText("1–30 ноября")).toBeTruthy();
    expect(appointmentCalls().filter((c) => JSON.stringify(c).includes("2026-11-01"))).toEqual([
      { params: { query: { from: "2026-11-01", to: "2026-11-30" } } },
    ]);
    expect(screen.getByRole("tab", { name: "Месяц" }).props.accessibilityState).toMatchObject({ selected: true });
    expect(await screen.findByLabelText("Понедельник, 2 ноября, 2 записи")).toBeTruthy();
    expect((await screen.findByLabelText("Среда, 4 ноября, 2 записи")).props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.queryByLabelText(/Понедельник, 26 октября/)).toBeNull();
    expect(screen.queryByLabelText(/Вторник, 1 декабря/)).toBeNull();
    expect(screen.getByText(/число записей/)).toBeTruthy();
    expect(screen.getByLabelText(/Ср, 4 ноября · 2 записи/)).toBeTruthy();
    expect(screen.getByLabelText(/Первая в 14:00, свободно 15:00–16:00/)).toBeTruthy();
  });

  it("tapping a month day shows its card and list", async () => {
    const user = userEvent.setup();
    await renderScreen();

    await screen.findByText("Светлана Петрова");
    await user.press(screen.getByText("Месяц"));
    await user.press(await screen.findByLabelText("Понедельник, 2 ноября, 2 записи"));

    expect(await screen.findByLabelText(/Пн, 2 ноября · 2 записи/)).toBeTruthy();
    expect(screen.getByText("Айгуль Сапарова")).toBeTruthy();
    expect(screen.queryByText("Светлана Петрова")).toBeNull();
  });

  it("the day card opens the week on that day", async () => {
    const user = userEvent.setup();
    await renderScreen();

    await screen.findByText("Светлана Петрова");
    await user.press(screen.getByText("Месяц"));
    await user.press(await screen.findByLabelText(/Ср, 4 ноября · 2 записи/));

    expect(await screen.findByText("2–8 ноября")).toBeTruthy();
    expect((await screen.findByLabelText("Среда, 4 ноября, 2 записи")).props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.getByRole("tab", { name: "Неделя" }).props.accessibilityState).toMatchObject({ selected: true });
  });

  it("moves to the next month", async () => {
    const user = userEvent.setup();
    await renderScreen();

    await screen.findByText("Светлана Петрова");
    await user.press(screen.getByText("Месяц"));
    await user.press(await screen.findByLabelText("Следующий месяц"));

    expect(await screen.findByText("1–31 декабря")).toBeTruthy();
    expect(screen.getByText("Декабрь")).toBeTruthy();
    expect(await screen.findByLabelText(/Пт, 4 декабря · Свободно/)).toBeTruthy();
    expect(screen.getByText("Свободно весь день")).toBeTruthy();
    await waitFor(() =>
      expect(appointmentCalls()).toContainEqual({ params: { query: { from: "2026-12-01", to: "2026-12-31" } } }),
    );
  });

  it("month day labels have no summary while loading", async () => {
    const user = userEvent.setup();
    mockGet.mockImplementation(async (path) => {
      if (path === "/settings") return ok(settings);
      return new Promise(() => {});
    });
    await renderScreen();

    await user.press(await screen.findByText("Месяц"));

    expect(await screen.findByLabelText("Среда, 4 ноября")).toBeTruthy();
    expect(screen.getByLabelText("Ср, 4 ноября")).toBeTruthy();
    expect(screen.queryByLabelText(/Свободно/)).toBeNull();
  });

  it("month view shows the load error above the grid", async () => {
    const { ApiError } = jest.requireActual<typeof import("@/lib/api/errors")>("@/lib/api/errors");
    const user = userEvent.setup();
    mockGet.mockImplementation(async (path) => {
      if (path === "/settings") return ok(settings);
      throw new ApiError("server", { status: 500 });
    });
    await renderScreen();

    await user.press(await screen.findByText("Месяц"));

    expect(await screen.findByText("Не получилось загрузить расписание. Попробуйте ещё раз.")).toBeTruthy();
    expect(screen.getByText("Обновить")).toBeTruthy();
  });

  describe("days off are shown as closed", () => {
    const timeOff: Schemas["TimeOffResponse"][] = [
      { id: "t1", start: "2026-11-08T00:00:00+05:00", end: "2026-11-09T00:00:00+05:00", reason: null },
      { id: "t2", start: "2026-11-05T14:00:00+05:00", end: "2026-11-05T18:00:00+05:00", reason: null },
    ];

    function timeOffCalls() {
      return mockGet.mock.calls.filter(([path]) => path === "/time-off").map(([, init]) => init);
    }

    beforeEach(() => {
      const base = mockGet.getMockImplementation();
      mockGet.mockImplementation(async (path, init) => {
        if (path === "/time-off") return ok(timeOff);
        return base ? base(path, init) : undefined;
      });
    });

    it("days off are shown as closed in the week", async () => {
      const user = userEvent.setup();
      await renderScreen();

      await user.press(await screen.findByLabelText("Воскресенье, 8 ноября, Выходной"));

      expect(await screen.findByText("Выходной день — бот не предлагает это время")).toBeTruthy();
      expect(screen.getByText("Выходной")).toBeTruthy();
      expect(screen.queryByText("Свободно весь день")).toBeNull();
      const button = screen.getByRole("button", { name: "Выходной — запись закрыта" });
      expect(button.props.accessibilityState).toMatchObject({ disabled: true });
      await user.press(button);
      expect(mockPush).not.toHaveBeenCalled();
      expect(timeOffCalls()).toContainEqual({ params: { query: { from: "2026-11-02", to: "2026-11-08" } } });
    });

    it("days off are shown as closed only for a whole day", async () => {
      const user = userEvent.setup();
      await renderScreen();

      await screen.findByLabelText("Воскресенье, 8 ноября, Выходной");
      expect(screen.queryByLabelText(/Четверг, 5 ноября, Выходной/)).toBeNull();
      expect(screen.queryByLabelText("Четверг, 5 ноября, Свободно")).toBeNull();
      await user.press(screen.getByLabelText("Четверг, 5 ноября, Записей нет"));

      expect(await screen.findByText("На этот день записей нет")).toBeTruthy();
      expect(screen.queryByText("Свободно")).toBeNull();
      expect(screen.queryByText("Свободно весь день")).toBeNull();
    });

    it("days off are shown as closed next to a free day", async () => {
      const user = userEvent.setup();
      await renderScreen();

      await screen.findByLabelText("Воскресенье, 8 ноября, Выходной");
      await user.press(screen.getByLabelText(/Пятница, 6 ноября/));

      expect(await screen.findByText("Свободно весь день")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Записать на пт, 6 ноября" })).toBeTruthy();
    });

    it("days off are shown as closed with appointments in the week", async () => {
      const user = userEvent.setup();
      const base = mockGet.getMockImplementation();
      mockGet.mockImplementation(async (path, init) => {
        if (path === "/appointments") {
          return ok([
            item("o1", "Ольга Ким", "2026-11-08T10:00:00+05:00", "2026-11-08T11:00:00+05:00"),
            item("o2", "Тимур Ахмедов", "2026-11-08T14:00:00+05:00", "2026-11-08T15:00:00+05:00"),
          ]);
        }
        return base ? base(path, init) : undefined;
      });
      await renderScreen();

      await user.press(await screen.findByLabelText("Воскресенье, 8 ноября, Выходной · 2 записи"));

      expect(await screen.findByText("Выходной день — бот не предлагает это время")).toBeTruthy();
      expect(screen.getByText("Ольга Ким")).toBeTruthy();
      expect(screen.getByText("Тимур Ахмедов")).toBeTruthy();
      expect(screen.getAllByText("Выходной · 2 записи").length).toBeGreaterThan(0);
      expect(screen.queryByText(/Свободно до/)).toBeNull();
      const button = screen.getByRole("button", { name: "Выходной — запись закрыта" });
      expect(button.props.accessibilityState).toMatchObject({ disabled: true });
      await user.press(button);
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("days off are shown as closed without free hours in the month card", async () => {
      const user = userEvent.setup();
      const base = mockGet.getMockImplementation();
      mockGet.mockImplementation(async (path, init) => {
        if (path === "/appointments") {
          return ok([
            item("o1", "Ольга Ким", "2026-11-08T10:00:00+05:00", "2026-11-08T11:00:00+05:00"),
            item("o2", "Тимур Ахмедов", "2026-11-08T14:00:00+05:00", "2026-11-08T15:00:00+05:00"),
          ]);
        }
        return base ? base(path, init) : undefined;
      });
      await renderScreen();

      await screen.findByLabelText("Воскресенье, 8 ноября, Выходной · 2 записи");
      await user.press(screen.getByText("Месяц"));
      await user.press(await screen.findByLabelText("Воскресенье, 8 ноября, Выходной · 2 записи"));

      expect(await screen.findByText("Вс, 8 ноября · Выходной · 2 записи")).toBeTruthy();
      expect(screen.getByText("Первая в 10:00")).toBeTruthy();
      expect(screen.queryByText(/свободно/)).toBeNull();
    });

    it("days off are shown as closed in the month", async () => {
      const user = userEvent.setup();
      await renderScreen();

      await screen.findByText("Светлана Петрова");
      await user.press(screen.getByText("Месяц"));

      expect(await screen.findByLabelText("Воскресенье, 8 ноября, Выходной")).toBeTruthy();
      expect(screen.getByText("выходной")).toBeTruthy();
      expect(timeOffCalls()).toContainEqual({ params: { query: { from: "2026-11-01", to: "2026-11-30" } } });

      await user.press(screen.getByLabelText("Следующий месяц"));

      expect(await screen.findByText("1–31 декабря")).toBeTruthy();
      expect(screen.queryByText("выходной")).toBeNull();
    });

    it("days off are shown as closed only when time off loads", async () => {
      const { ApiError } = jest.requireActual<typeof import("@/lib/api/errors")>("@/lib/api/errors");
      mockGet.mockImplementation(async (path) => {
        if (path === "/settings") return ok(settings);
        if (path === "/appointments") return ok(week);
        throw new ApiError("server", { status: 500 });
      });
      await renderScreen();

      expect(await screen.findByText("Не получилось загрузить расписание. Попробуйте ещё раз.")).toBeTruthy();
      expect(screen.getByText("Обновить")).toBeTruthy();
      expect(screen.queryByText("Светлана Петрова")).toBeNull();
    });
  });
});
