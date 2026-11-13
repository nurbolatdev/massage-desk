import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { components } from "@massage-desk/api-types";
import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import TimeOffListScreen from "@/app/time-off/index";

type Call = (path: string, init?: unknown) => Promise<unknown>;

const mockGet = jest.fn<Call>();
const mockDelete = jest.fn<Call>();
const mockBack = jest.fn();
const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ canGoBack: () => true, back: mockBack, replace: jest.fn(), push: mockPush }),
}));

jest.mock("@/lib/time/useNow", () => ({
  // Wednesday 4 November 2026, 10:00 in Asia/Almaty (UTC+5).
  useNow: () => new Date("2026-11-04T05:00:00Z"),
}));

jest.mock("@/lib/api", () => ({
  api: {
    GET: (path: string, init?: unknown) => mockGet(path, init),
    DELETE: (path: string, init?: unknown) => mockDelete(path, init),
  },
  unwrap: jest.requireActual<typeof import("@/lib/api/client")>("@/lib/api/client").unwrap,
  ApiError: jest.requireActual<typeof import("@/lib/api/errors")>("@/lib/api/errors").ApiError,
}));

type Schemas = components["schemas"];
type Item = Schemas["TimeOffResponse"];

const settings: Schemas["SettingsResponse"] = { timeZone: "Asia/Almaty", botEnabled: true, address: null };

const vacation: Item = { id: "t1", start: "2026-12-14T19:00:00Z", end: "2026-12-22T19:00:00Z", reason: null };
const dayOff: Item = { id: "t2", start: "2026-12-30T19:00:00Z", end: "2026-12-31T19:00:00Z", reason: null };
const partDay: Item = { id: "t3", start: "2026-12-15T08:00:00Z", end: "2026-12-15T12:00:00Z", reason: null };
const earlier: Item = { id: "t4", start: "2026-11-03T19:00:00Z", end: "2026-11-04T03:00:00Z", reason: null };

function ok(data: unknown, status = 200) {
  return { data, response: new Response(null, { status }) };
}

function failure(status: number) {
  return { error: { code: "INTERNAL" }, response: new Response(null, { status }) };
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
        <TimeOffListScreen />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

function answer(first: Item[], second: Item[] = []) {
  mockGet.mockImplementation(async (path, init) => {
    if (path === "/settings") return ok(settings);
    if (path === "/time-off") {
      const from = (init as { params: { query: { from: string } } }).params.query.from;
      return ok(from === "2026-11-04" ? first : second);
    }
    throw new Error(`unexpected GET ${path}`);
  });
}

function timeOffCalls() {
  return mockGet.mock.calls.filter(([path]) => path === "/time-off");
}

describe("time off list screen", () => {
  beforeEach(() => {
    onlineManager.setOnline(true);
    mockGet.mockReset();
    mockDelete.mockReset();
    mockBack.mockReset();
    mockPush.mockReset();
    answer([]);
  });

  afterEach(async () => {
    await cleanup();
    onlineManager.setOnline(true);
    queryClient.clear();
  });

  it("asks for two windows that cover two years ahead", async () => {
    await renderScreen();
    await screen.findByText(/Пока ничего не задано/);

    const queries = timeOffCalls().map(([, init]) => (init as { params: { query: unknown } }).params.query);
    expect(queries).toHaveLength(2);
    expect(queries).toContainEqual({ from: "2026-11-04", to: "2027-11-04" });
    expect(queries).toContainEqual({ from: "2027-11-05", to: "2028-11-04" });
  });

  it("lists current and future periods in start order", async () => {
    answer([dayOff, vacation, partDay, earlier]);
    await renderScreen();

    expect(await screen.findByText("15 – 22 декабря")).toBeTruthy();
    expect(screen.getByText("Отпуск · 8 дней")).toBeTruthy();
    expect(screen.getByText("31 декабря")).toBeTruthy();
    expect(screen.getByText("Выходной")).toBeTruthy();
    expect(screen.getByText("Отгул · 13:00 – 17:00")).toBeTruthy();
    expect(screen.queryByText("4 ноября")).toBeNull();
    expect(screen.queryByText("3 ноября")).toBeNull();

    const titles = screen.getAllByText(/декабря/).map((node) => node.props.children);
    expect(titles).toEqual(["15 – 22 декабря", "15 декабря", "31 декабря"]);
  });

  it("shows a period that both windows return once", async () => {
    answer([vacation], [vacation]);
    await renderScreen();

    expect(await screen.findByText("15 – 22 декабря")).toBeTruthy();
    expect(screen.getAllByText("15 – 22 декабря")).toHaveLength(1);
  });

  it("explains an empty list", async () => {
    await renderScreen();

    expect(
      await screen.findByText("Пока ничего не задано. Нажмите «Добавить даты», чтобы отметить выходной или отпуск."),
    ).toBeTruthy();
  });

  it("opens the picker from the add button and goes back from the header", async () => {
    const user = userEvent.setup();
    await renderScreen();
    await screen.findByText(/Пока ничего не задано/);

    await user.press(screen.getByRole("button", { name: "Добавить даты" }));
    expect(mockPush).toHaveBeenCalledWith("/time-off/new");

    await user.press(screen.getByLabelText("Назад"));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("shows a loading skeleton while the settings are not loaded", async () => {
    mockGet.mockImplementation(() => new Promise(() => undefined));
    await renderScreen();

    expect(screen.getByRole("progressbar", { name: "Загрузка" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Добавить даты" })).toBeTruthy();
  });

  it("offline without saved data explains that the list needs internet", async () => {
    onlineManager.setOnline(false);
    await renderScreen();

    expect(await screen.findByText("Выходные и отпуск появятся, когда телефон подключится к интернету.")).toBeTruthy();
  });

  it("offline with saved data keeps the list and says why changes wait", async () => {
    answer([vacation]);
    await renderScreen();
    await screen.findByText("15 – 22 декабря");

    onlineManager.setOnline(false);

    expect(await screen.findByText("Удалить или добавить дни можно, когда телефон подключится к интернету.")).toBeTruthy();
    expect(screen.getByText("15 – 22 декабря")).toBeTruthy();
  });

  it("shows a load error and refetches on retry", async () => {
    mockGet.mockImplementation(async (path) => {
      if (path === "/settings") return ok(settings);
      return failure(500);
    });
    const user = userEvent.setup();
    await renderScreen();

    expect(await screen.findByText("Не получилось загрузить расписание. Попробуйте ещё раз.")).toBeTruthy();
    const before = timeOffCalls().length;

    await user.press(screen.getByRole("button", { name: "Обновить" }));

    await waitFor(() => expect(timeOffCalls().length).toBeGreaterThan(before));
  });

  it("keeps the list and warns when a refresh fails", async () => {
    answer([vacation]);
    const user = userEvent.setup();
    await renderScreen();
    await screen.findByText("15 – 22 декабря");

    mockGet.mockImplementation(async (path) => {
      if (path === "/settings") return ok(settings);
      return failure(500);
    });
    await queryClient.refetchQueries({ queryKey: ["timeOff"] }).catch(() => undefined);

    expect(await screen.findByText("Не получилось обновить расписание")).toBeTruthy();
    expect(screen.getByText("15 – 22 декабря")).toBeTruthy();

    answer([vacation]);
    const before = timeOffCalls().length;
    await user.press(screen.getByRole("button", { name: "Обновить" }));
    await waitFor(() => expect(timeOffCalls().length).toBeGreaterThan(before));
  });

  describe("removing", () => {
    const noContent = () => ({ data: undefined, response: new Response(null, { status: 204 }) });

    it("asks first and sends nothing until confirmed", async () => {
      answer([vacation]);
      const user = userEvent.setup();
      await renderScreen();
      await screen.findByText("15 – 22 декабря");

      await user.press(screen.getByRole("button", { name: "Удалить 15 – 22 декабря" }));
      expect(await screen.findByText("Удалить отпуск?")).toBeTruthy();
      expect(screen.getByText("На 15 – 22 декабря снова можно будет записаться.")).toBeTruthy();
      expect(mockDelete).not.toHaveBeenCalled();

      const [, cancel] = screen.getAllByRole("button", { name: "Нет, оставить" });
      expect(cancel).toBeTruthy();
      if (cancel !== undefined) await user.press(cancel);
      await waitFor(() => expect(screen.queryByText("Удалить отпуск?")).toBeNull());
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it("removes the period, refreshes the list and reopens the time", async () => {
      answer([vacation, dayOff]);
      mockDelete.mockResolvedValue(noContent());
      const user = userEvent.setup();
      await renderScreen();
      await screen.findByText("15 – 22 декабря");
      queryClient.setQueryData(["slots", "s1", "2026-12-15"], []);

      answer([dayOff]);
      await user.press(screen.getByRole("button", { name: "Удалить 15 – 22 декабря" }));
      await user.press(await screen.findByRole("button", { name: "Да, удалить" }));

      await waitFor(() => expect(screen.queryByText("15 – 22 декабря")).toBeNull());
      expect(mockDelete).toHaveBeenCalledWith("/time-off/{id}", { params: { path: { id: "t1" } } });
      expect(screen.getByText("31 декабря")).toBeTruthy();
      expect(queryClient.getQueryState(["slots", "s1", "2026-12-15"])?.isInvalidated).toBe(true);
    });

    it("treats an already removed period as removed", async () => {
      answer([vacation]);
      mockDelete.mockResolvedValue({
        error: { code: "TIME_OFF_NOT_FOUND" },
        response: new Response(null, { status: 404 }),
      });
      const user = userEvent.setup();
      await renderScreen();
      await screen.findByText("15 – 22 декабря");

      answer([]);
      await user.press(screen.getByRole("button", { name: "Удалить 15 – 22 декабря" }));
      await user.press(await screen.findByRole("button", { name: "Да, удалить" }));

      await waitFor(() => expect(screen.queryByText("Удалить отпуск?")).toBeNull());
      expect(await screen.findByText(/Пока ничего не задано/)).toBeTruthy();
    });

    it("keeps the sheet and the row when removing fails", async () => {
      answer([vacation]);
      mockDelete.mockResolvedValue(failure(500));
      const user = userEvent.setup();
      await renderScreen();
      await screen.findByText("15 – 22 декабря");

      await user.press(screen.getByRole("button", { name: "Удалить 15 – 22 декабря" }));
      await user.press(await screen.findByRole("button", { name: "Да, удалить" }));

      expect(await screen.findByText("Не получилось удалить. Проверьте интернет и попробуйте ещё раз.")).toBeTruthy();
      expect(screen.getByText("Удалить отпуск?")).toBeTruthy();
      expect(screen.getAllByText("15 – 22 декабря").length).toBeGreaterThan(0);
    });

    it("disables removal offline", async () => {
      answer([vacation]);
      await renderScreen();
      await screen.findByText("15 – 22 декабря");

      onlineManager.setOnline(false);
      await screen.findByText("Удалить или добавить дни можно, когда телефон подключится к интернету.");

      expect(screen.getByRole("button", { name: "Удалить 15 – 22 декабря" })).toBeDisabled();
    });

    it("words a day off as a day off", async () => {
      answer([dayOff]);
      const user = userEvent.setup();
      await renderScreen();
      await screen.findByText("31 декабря");

      await user.press(screen.getByRole("button", { name: "Удалить 31 декабря" }));

      expect(await screen.findByText("Удалить выходной?")).toBeTruthy();
    });
  });
});
