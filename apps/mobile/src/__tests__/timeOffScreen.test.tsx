import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { components } from "@massage-desk/api-types";
import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import NewTimeOffScreen from "@/app/time-off/new";

type Call = (path: string, init?: unknown) => Promise<unknown>;

const mockGet = jest.fn<Call>();
const mockPost = jest.fn<Call>();
const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ canGoBack: () => true, back: mockBack, replace: jest.fn(), push: jest.fn() }),
}));

jest.mock("@/lib/time/useNow", () => ({
  // Wednesday 4 November 2026, 10:00 in Asia/Almaty (UTC+5).
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

const settings: Schemas["SettingsResponse"] = { timeZone: "Asia/Almaty", botEnabled: true, address: null };

const booked: Schemas["AppointmentListItem"] = {
  id: "a1",
  clientId: "c1",
  clientName: "Ержан Бекенов",
  clientPhone: "+77010000000",
  serviceId: "s1",
  serviceName: "Массаж спины",
  start: "2026-11-15T11:00:00+05:00",
  end: "2026-11-15T12:00:00+05:00",
  status: "confirmed",
  source: "bot",
};

function ok(data: unknown, status = 200) {
  return { data, response: new Response(null, { status }) };
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
        <NewTimeOffScreen />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

function saveButton() {
  return screen.getByRole("button", { name: "Сохранить" });
}

describe("new time off screen", () => {
  beforeEach(() => {
    onlineManager.setOnline(true);
    mockGet.mockReset();
    mockPost.mockReset();
    mockBack.mockReset();
    mockGet.mockImplementation(async (path) => {
      if (path === "/settings") return ok(settings);
      if (path === "/appointments") return ok([booked]);
      if (path === "/time-off") return ok([]);
      if (path === "/working-hours") return ok({ blocks: [] });
      throw new Error(`unexpected GET ${path}`);
    });
    mockPost.mockResolvedValue(ok({ id: "t1" }, 201));
  });

  afterEach(async () => {
    await cleanup();
    onlineManager.setOnline(true);
    queryClient.clear();
  });

  it("starts empty: hint shown, save disabled", async () => {
    await renderScreen();

    expect(await screen.findByText("Нажмите на первый и последний день отпуска. Один день — выходной.")).toBeTruthy();
    expect(await screen.findByText("Ноябрь")).toBeTruthy();
    expect(saveButton().props.accessibilityState).toMatchObject({ disabled: true });
  });

  it("saves one picked day as a whole local day and goes back", async () => {
    const user = userEvent.setup();
    await renderScreen();

    await user.press(await screen.findByLabelText(/^Воскресенье, 15 ноября/));

    expect(screen.getByText("15 ноября")).toBeTruthy();
    expect(screen.getByText("Выходной")).toBeTruthy();
    expect(saveButton().props.accessibilityState).toMatchObject({ disabled: false });

    await user.press(saveButton());

    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith("/time-off", {
      body: { start: "2026-11-14T19:00:00.000Z", end: "2026-11-15T19:00:00.000Z" },
    });
  });

  it("saves a vacation as one period from the first to the last day", async () => {
    const user = userEvent.setup();
    await renderScreen();

    await user.press(await screen.findByLabelText(/^Понедельник, 16 ноября/));
    await user.press(screen.getByLabelText(/^Понедельник, 23 ноября/));

    expect(screen.getByText("16 – 23 ноября")).toBeTruthy();
    expect(screen.getByText("Отпуск · 8 дней")).toBeTruthy();
    expect(screen.getByLabelText(/^Среда, 18 ноября/).props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByLabelText(/^Вторник, 24 ноября/).props.accessibilityState).toMatchObject({ selected: false });

    await user.press(saveButton());

    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
    expect(mockPost).toHaveBeenCalledWith("/time-off", {
      body: { start: "2026-11-15T19:00:00.000Z", end: "2026-11-23T19:00:00.000Z" },
    });
  });

  it("picks a vacation across a month boundary", async () => {
    const user = userEvent.setup();
    await renderScreen();

    await user.press(await screen.findByLabelText(/^Понедельник, 30 ноября/));
    await user.press(screen.getByLabelText("Следующий месяц"));
    await user.press(await screen.findByLabelText(/^Четверг, 3 декабря/));

    expect(screen.getByText("30 ноября – 3 декабря")).toBeTruthy();
    expect(screen.getByText("Отпуск · 4 дня")).toBeTruthy();
    expect(screen.getByLabelText(/^Среда, 2 декабря/).props.accessibilityState).toMatchObject({ selected: true });
  });

  it("moves between months", async () => {
    const user = userEvent.setup();
    await renderScreen();

    await screen.findByText("Ноябрь");
    await user.press(screen.getByLabelText("Следующий месяц"));

    expect(await screen.findByText("Декабрь")).toBeTruthy();
    expect(screen.getByText("1–31 декабря")).toBeTruthy();
  });

  it("shows how many appointments a day has", async () => {
    await renderScreen();

    expect(await screen.findByLabelText("Воскресенье, 15 ноября, 1 запись")).toBeTruthy();
  });

  it("shows a skeleton while the zone is unknown", async () => {
    mockGet.mockImplementation(() => new Promise(() => {}));
    await renderScreen();

    expect(await screen.findByLabelText("Загружаем расписание…")).toBeTruthy();
    expect(saveButton().props.accessibilityState).toMatchObject({ disabled: true });
  });

  it("offers a retry when loading fails", async () => {
    mockGet.mockImplementation(async () => ({
      error: { code: "INTERNAL", status: 500, title: "Error", detail: "", instance: "/" },
      response: new Response(null, { status: 500 }),
    }));
    const user = userEvent.setup();
    await renderScreen();

    await user.press(await screen.findByRole("button", { name: "Обновить" }));

    await waitFor(() => expect(mockGet.mock.calls.filter(([path]) => path === "/settings").length).toBeGreaterThan(1));
  });

  it("blocks saving offline and says why", async () => {
    const user = userEvent.setup();
    await renderScreen();

    await user.press(await screen.findByLabelText(/^Воскресенье, 15 ноября/));
    await screen.findByText("Выходной");
    onlineManager.setOnline(false);

    expect(await screen.findByText("Отметить выходной можно, когда телефон подключится к интернету.")).toBeTruthy();
    expect(saveButton().props.accessibilityState).toMatchObject({ disabled: true });
  });

  it("shows an error and stays when saving fails", async () => {
    mockPost.mockResolvedValue({
      error: { code: "INTERNAL", status: 500, title: "Error", detail: "", instance: "/time-off" },
      response: new Response(null, { status: 500 }),
    });
    const user = userEvent.setup();
    await renderScreen();

    await user.press(await screen.findByLabelText(/^Воскресенье, 15 ноября/));
    await user.press(saveButton());

    expect(await screen.findByText(/Не получилось сохранить/)).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
  });

  describe("appointments inside the days", () => {
    const conflictBody = {
      error: {
        code: "APPOINTMENT_CONFLICT",
        status: 409,
        title: "Conflict",
        detail: "",
        instance: "/time-off",
        conflicts: [
          { appointmentId: "a1", clientName: "Ержан Бекенов", start: "2026-11-15T11:00:00+05:00", end: "2026-11-15T12:00:00+05:00" },
        ],
      },
      response: new Response(null, { status: 409 }),
    };

    async function pickAndSave(user: ReturnType<typeof userEvent.setup>) {
      await user.press(await screen.findByLabelText(/^Воскресенье, 15 ноября/));
      await user.press(saveButton());
      await screen.findByText("Закрыть дни с записями?");
    }

    beforeEach(() => {
      mockPost.mockResolvedValueOnce(conflictBody);
    });

    it("shows who is booked and closes the days only after confirmation", async () => {
      const user = userEvent.setup();
      await renderScreen();

      await pickAndSave(user);

      expect(screen.getByRole("alert")).toHaveTextContent(
        /На 15 ноября уже есть 1 запись \(Ержан Бекенов, 11:00\)\. Перенесите её или отмените\./,
      );
      expect(mockPost).toHaveBeenCalledTimes(1);
      expect(mockPost.mock.calls[0]?.[1]).toEqual({
        body: { start: "2026-11-14T19:00:00.000Z", end: "2026-11-15T19:00:00.000Z" },
      });

      await user.press(screen.getByRole("button", { name: "Да, закрыть дни" }));

      await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
      expect(mockPost).toHaveBeenCalledTimes(2);
      expect(mockPost.mock.calls[1]?.[1]).toEqual({
        body: { start: "2026-11-14T19:00:00.000Z", end: "2026-11-15T19:00:00.000Z", force: true },
      });
    });

    it("keeps the alert and the days when the master declines", async () => {
      const user = userEvent.setup();
      await renderScreen();

      await pickAndSave(user);
      await user.press(screen.getAllByRole("button", { name: "Нет, оставить" })[0]!);

      expect(mockPost).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("alert")).toBeTruthy();
      expect(screen.getByText("Выходной")).toBeTruthy();
      expect(mockBack).not.toHaveBeenCalled();
    });

    it("hides the alert when other days are picked", async () => {
      const user = userEvent.setup();
      await renderScreen();

      await pickAndSave(user);
      await user.press(screen.getAllByRole("button", { name: "Нет, оставить" })[0]!);
      await user.press(screen.getByLabelText(/^Понедельник, 16 ноября/));

      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("shows an error inside the sheet when the forced save fails", async () => {
      mockPost.mockResolvedValueOnce({
        error: { code: "INTERNAL", status: 500, title: "Error", detail: "", instance: "/time-off" },
        response: new Response(null, { status: 500 }),
      });
      const user = userEvent.setup();
      await renderScreen();

      await pickAndSave(user);
      await user.press(screen.getByRole("button", { name: "Да, закрыть дни" }));

      expect(await screen.findByText(/Не получилось сохранить/)).toBeTruthy();
      expect(mockBack).not.toHaveBeenCalled();
    });
  });
});
