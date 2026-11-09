import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { components } from "@massage-desk/api-types";
import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import RescheduleScreen from "@/app/reschedule/[id]";
import { BACK_LABEL, NOT_FOUND_TITLE } from "@/lib/data/appointmentCard";
import { localDay } from "@/lib/data/days";
import { CHOOSE_TIME, conflictTitle, OUTSIDE_TEXT, serviceMeta, takenA11y } from "@/lib/data/newBooking";
import { queryKeys } from "@/lib/data/queryKeys";
import {
  currentLine,
  NOW_LABEL,
  RESCHEDULE_CONFIRM_TITLE,
  RESCHEDULE_CONFIRM_YES,
  RESCHEDULE_GONE_TEXT,
  RESCHEDULE_GONE_TITLE,
  RESCHEDULE_OFFLINE_TEXT,
  rescheduleConfirmText,
} from "@/lib/data/reschedule";

type Call = (path: string, init?: unknown) => Promise<unknown>;

const mockGet = jest.fn<Call>();
const mockPost = jest.fn<Call>();
const mockDismissTo = jest.fn();

type Schemas = components["schemas"];

const TIME_ZONE = "Asia/Tashkent";
const DAY = localDay(new Date(), TIME_ZONE);
const START = `${DAY}T09:00:00+05:00`;
const END = `${DAY}T10:00:00+05:00`;
const BUSY = `${DAY}T10:00:00+05:00`;
const FREE = `${DAY}T11:30:00+05:00`;

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "a1", day: mockDay() }),
  useRouter: () => ({
    canGoBack: () => true,
    back: jest.fn(),
    replace: jest.fn(),
    push: jest.fn(),
    dismissTo: mockDismissTo,
  }),
}));

function mockDay(): string {
  return DAY;
}

jest.mock("@/lib/api", () => ({
  api: {
    GET: (path: string, init?: unknown) => mockGet(path, init),
    POST: (path: string, init?: unknown) => mockPost(path, init),
  },
  unwrap: jest.requireActual<typeof import("@/lib/api/client")>("@/lib/api/client").unwrap,
  ApiError: jest.requireActual<typeof import("@/lib/api/errors")>("@/lib/api/errors").ApiError,
}));

const settings: Schemas["SettingsResponse"] = { timeZone: TIME_ZONE, botEnabled: true, address: null };

const listItem: Schemas["AppointmentListItem"] = {
  id: "a1",
  clientId: "c1",
  clientName: "Анна",
  clientPhone: "+998901234567",
  serviceId: "s1",
  serviceName: "Классический массаж",
  start: START,
  end: END,
  status: "confirmed",
  source: "bot",
};

const moved: Schemas["AppointmentResponse"] = {
  id: "a1",
  clientId: "c1",
  serviceId: "s1",
  start: FREE,
  end: `${DAY}T12:30:00+05:00`,
  status: "confirmed",
  source: "bot",
};

function ok(data: unknown) {
  return { data, response: new Response(null, { status: 200 }) };
}

function failure(status: number, code: string) {
  return {
    error: { code, status, title: "Error", detail: "", instance: "/appointments/a1/reschedule" },
    response: new Response(null, { status }),
  };
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
});

let appointmentsAnswer: () => Schemas["AppointmentListItem"][] = () => [listItem];
let slotsGate: Promise<void> | null = null;

function slotRequests(): number {
  return mockGet.mock.calls.filter(([path]) => path === "/slots").length;
}

function appointmentRequests(): number {
  return mockGet.mock.calls.filter(([path]) => path === "/appointments").length;
}

function renderScreen() {
  return render(
    <SafeAreaProvider
      initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}
    >
      <QueryClientProvider client={queryClient}>
        <RescheduleScreen />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

describe("reschedule screen", () => {
  beforeEach(() => {
    onlineManager.setOnline(true);
    mockGet.mockReset();
    mockPost.mockReset();
    mockDismissTo.mockReset();
    appointmentsAnswer = () => [listItem];
    slotsGate = null;
    mockGet.mockImplementation(async (path, init) => {
      if (path === "/settings") return ok(settings);
      if (path === "/appointments") return ok(appointmentsAnswer());
      if (path === "/slots") {
        const requested = (init as { params: { query: { day: string } } }).params.query.day;
        if (slotRequests() === 2 && slotsGate !== null) await slotsGate;
        const starts =
          slotRequests() <= 2
            ? [`${requested}T10:00:00+05:00`, `${requested}T11:30:00+05:00`]
            : [`${requested}T11:30:00+05:00`];
        return ok({ day: requested, timeZone: TIME_ZONE, durationMin: 60, starts });
      }
      throw new Error(`unexpected GET ${path}`);
    });
    queryClient.setQueryData(queryKeys.settings, settings);
    queryClient.setQueryData(queryKeys.appointments.range(DAY, DAY), [listItem]);
  });

  afterEach(async () => {
    onlineManager.setOnline(true);
    // Unmount first: observers leaving after clear() would re-arm the query gc timers.
    await cleanup();
    queryClient.clear();
  });

  it("shows the current time and client", async () => {
    await renderScreen();
    expect(screen.getByText(NOW_LABEL)).toBeOnTheScreen();
    expect(screen.getByText(currentLine(new Date(START), TIME_ZONE))).toBeOnTheScreen();
    expect(screen.getByText(`Анна · Классический массаж, ${serviceMeta(60)}`)).toBeOnTheScreen();
  });

  it("asks first, then keeps a taken time out of reach and moves to the new time", async () => {
    mockPost.mockResolvedValueOnce(failure(409, "TIME_TAKEN")).mockResolvedValueOnce(ok(moved));
    await renderScreen();
    const user = userEvent.setup();

    await user.press(await screen.findByText("10:00"));
    await user.press(screen.getByRole("button", { name: /^Перенести на / }));
    expect(await screen.findByText(RESCHEDULE_CONFIRM_TITLE)).toBeOnTheScreen();
    expect(mockPost).not.toHaveBeenCalled();

    await user.press(screen.getByRole("button", { name: RESCHEDULE_CONFIRM_YES }));
    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(mockPost).toHaveBeenCalledWith("/appointments/{id}/reschedule", {
      params: { path: { id: "a1" } },
      body: { start: BUSY },
    });

    expect(await screen.findByText(conflictTitle("10:00"))).toBeOnTheScreen();
    const takenChip = screen.getByRole("button", { name: takenA11y("10:00") });
    expect(takenChip.props.accessibilityState).toMatchObject({ disabled: true });
    await waitFor(() => expect(slotRequests()).toBeGreaterThanOrEqual(2));

    await user.press(takenChip);
    await user.press(screen.getByRole("button", { name: CHOOSE_TIME }));
    expect(mockPost).toHaveBeenCalledTimes(1);

    const before = appointmentRequests();
    await user.press(screen.getByText("11:30"));
    await user.press(screen.getByRole("button", { name: /^Перенести на / }));
    await user.press(screen.getByRole("button", { name: RESCHEDULE_CONFIRM_YES }));
    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(2));
    expect(mockPost).toHaveBeenLastCalledWith("/appointments/{id}/reschedule", {
      params: { path: { id: "a1" } },
      body: { start: FREE },
    });

    await waitFor(() => expect(mockDismissTo).toHaveBeenCalled());
    expect(mockDismissTo).toHaveBeenCalledWith({ pathname: "/appointment/[id]", params: { id: "a1", day: DAY } });
    expect(appointmentRequests()).toBeGreaterThan(before);
  });

  it("tells that the appointment has changed when it is no longer confirmed", async () => {
    mockPost.mockImplementation(async () => {
      appointmentsAnswer = () => [{ ...listItem, status: "cancelled" }];
      return failure(409, "NOT_CONFIRMED");
    });
    await renderScreen();
    const user = userEvent.setup();

    await user.press(await screen.findByText("10:00"));
    await user.press(screen.getByRole("button", { name: /^Перенести на / }));
    await user.press(screen.getByRole("button", { name: RESCHEDULE_CONFIRM_YES }));

    expect(await screen.findByText(RESCHEDULE_GONE_TITLE)).toBeOnTheScreen();
    expect(screen.getByText(RESCHEDULE_GONE_TEXT)).toBeOnTheScreen();
    expect(screen.getAllByRole("button", { name: BACK_LABEL })).toHaveLength(2);
    expect(mockDismissTo).not.toHaveBeenCalled();
  });

  it("keeps the sheet while the data refreshes after a move to another day", async () => {
    const next = localDay(new Date(Date.now() + 24 * 3600 * 1000), TIME_ZONE);
    const target = `${next}T11:30:00+05:00`;
    let release: () => void = () => undefined;
    slotsGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    mockPost.mockImplementation(async () => {
      appointmentsAnswer = () => [];
      return ok({ ...moved, start: target, end: `${next}T12:30:00+05:00` });
    });
    await renderScreen();
    const user = userEvent.setup();

    await user.press(await screen.findByText("10:00"));
    await user.press(screen.getByRole("button", { name: /^Перенести на / }));
    const before = appointmentRequests();
    await user.press(screen.getByRole("button", { name: RESCHEDULE_CONFIRM_YES }));

    await waitFor(() => expect(appointmentRequests()).toBeGreaterThan(before));
    await waitFor(() => expect(queryClient.getQueryData(queryKeys.appointments.range(DAY, DAY))).toEqual([]));
    expect(mockDismissTo).not.toHaveBeenCalled();
    expect(screen.queryByText(NOT_FOUND_TITLE)).not.toBeOnTheScreen();
    expect(screen.getByText(RESCHEDULE_CONFIRM_TITLE)).toBeOnTheScreen();

    release();
    await waitFor(() => expect(mockDismissTo).toHaveBeenCalled());
    expect(mockDismissTo).toHaveBeenCalledWith({ pathname: "/appointment/[id]", params: { id: "a1", day: next } });
  });

  it("keeps the old time in the sheet while the data refreshes after a same-day move", async () => {
    let release: () => void = () => undefined;
    slotsGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    mockPost.mockImplementation(async () => {
      appointmentsAnswer = () => [{ ...listItem, start: BUSY, end: `${DAY}T11:00:00+05:00` }];
      return ok({ ...moved, start: BUSY, end: `${DAY}T11:00:00+05:00` });
    });
    await renderScreen();
    const user = userEvent.setup();

    await user.press(await screen.findByText("10:00"));
    await user.press(screen.getByRole("button", { name: /^Перенести на / }));
    const before = appointmentRequests();
    await user.press(screen.getByRole("button", { name: RESCHEDULE_CONFIRM_YES }));

    await waitFor(() => expect(appointmentRequests()).toBeGreaterThan(before));
    await waitFor(() =>
      expect(queryClient.getQueryData(queryKeys.appointments.range(DAY, DAY))).toEqual([
        { ...listItem, start: BUSY, end: `${DAY}T11:00:00+05:00` },
      ]),
    );
    expect(screen.getByText(rescheduleConfirmText(new Date(START), new Date(BUSY), TIME_ZONE))).toBeOnTheScreen();

    release();
    await waitFor(() => expect(mockDismissTo).toHaveBeenCalled());
  });

  it("shows the outside-schedule text and disables the time", async () => {
    mockPost.mockResolvedValue(failure(422, "OUTSIDE_SCHEDULE"));
    await renderScreen();
    const user = userEvent.setup();

    await user.press(await screen.findByText("10:00"));
    await user.press(screen.getByRole("button", { name: /^Перенести на / }));
    await user.press(screen.getByRole("button", { name: RESCHEDULE_CONFIRM_YES }));

    expect(await screen.findByText(OUTSIDE_TEXT)).toBeOnTheScreen();
    const chip = screen.getByRole("button", { name: takenA11y("10:00") });
    expect(chip.props.accessibilityState).toMatchObject({ disabled: true });
    expect(mockDismissTo).not.toHaveBeenCalled();
  });

  it("disables the button offline", async () => {
    onlineManager.setOnline(false);
    await renderScreen();

    expect(screen.getByText(RESCHEDULE_OFFLINE_TEXT)).toBeOnTheScreen();
    const button = screen.getByRole("button", { name: CHOOSE_TIME });
    expect(button.props.accessibilityState).toMatchObject({ disabled: true });
  });
});
