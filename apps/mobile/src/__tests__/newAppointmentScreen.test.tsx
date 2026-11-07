import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { components } from "@massage-desk/api-types";
import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import NewAppointmentScreen from "@/app/new-appointment";
import { clearBookingNotice, getBookingNotice } from "@/lib/data/bookingNotice";
import { localDay } from "@/lib/data/days";
import { CHOOSE_TIME, conflictTitle, takenA11y } from "@/lib/data/newBooking";
import { NEW_CLIENT_INFO_BOLD, PHONE_STEP } from "@/lib/data/clientPicker";
import { queryKeys } from "@/lib/data/queryKeys";

type Call = (path: string, init?: unknown) => Promise<unknown>;

const mockGet = jest.fn<Call>();
const mockPost = jest.fn<Call>();
const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ canGoBack: () => true, back: mockBack, replace: jest.fn(), push: jest.fn() }),
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

const TIME_ZONE = "Asia/Tashkent";

const settings: Schemas["SettingsResponse"] = { timeZone: TIME_ZONE, botEnabled: true, address: null };

const service: Schemas["ServiceResponse"] = { id: "s1", name: "Классический массаж", durationMin: 60, price: 100, active: true, sortOrder: 1 };

const client: Schemas["ClientResponse"] = {
  id: "c1",
  name: "Анна",
  phone: "+998901234567",
  notes: null,
  createdAt: "2026-10-01T09:00:00+05:00",
};

function ok(data: unknown, status = 200) {
  return { data, response: new Response(null, { status }) };
}

const timeTaken = {
  error: { code: "TIME_TAKEN", status: 409, title: "Conflict", detail: "", instance: "/appointments" },
  response: new Response(null, { status: 409 }),
};

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
});

function slotRequests(): number {
  return mockGet.mock.calls.filter(([path]) => path === "/slots").length;
}

describe("new appointment screen", () => {
  const day = localDay(new Date(), TIME_ZONE);
  const busy = `${day}T10:00:00+05:00`;
  const free = `${day}T11:30:00+05:00`;
  const booked: Schemas["AppointmentResponse"] = {
    id: "a-new",
    clientId: "c1",
    serviceId: "s1",
    start: free,
    end: `${day}T12:30:00+05:00`,
    status: "confirmed",
    source: "manual",
  };

  beforeEach(() => {
    onlineManager.setOnline(true);
    mockGet.mockReset();
    mockPost.mockReset();
    mockBack.mockReset();
    mockGet.mockImplementation(async (path, init) => {
      if (path === "/clients") return ok([client]);
      if (path === "/slots") {
        const requested = (init as { params: { query: { day: string } } }).params.query.day;
        const starts = slotRequests() === 1 ? [`${requested}T10:00:00+05:00`, `${requested}T11:30:00+05:00`] : [`${requested}T11:30:00+05:00`];
        return ok({ day: requested, timeZone: TIME_ZONE, durationMin: 60, starts });
      }
      throw new Error(`unexpected GET ${path}`);
    });
    mockPost.mockResolvedValueOnce(timeTaken).mockResolvedValueOnce(ok(booked, 201));
    queryClient.setQueryData(queryKeys.settings, settings);
    queryClient.setQueryData(queryKeys.services, [service]);
  });

  afterEach(async () => {
    onlineManager.setOnline(true);
    clearBookingNotice();
    // Unmount first: observers leaving after clear() would re-arm the 5 minute query gc timers.
    await cleanup();
    queryClient.clear();
  });

  it("busy time cannot be chosen", async () => {
    await render(
      <SafeAreaProvider
        initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}
      >
        <QueryClientProvider client={queryClient}>
          <NewAppointmentScreen />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(PHONE_STEP), "901234567");
    await user.press(await screen.findByText("Анна"));

    expect(await screen.findByText("10:00")).toBeOnTheScreen();
    expect(screen.queryByText("12:00")).toBeNull();
    await user.press(screen.getByText("10:00"));

    await user.press(screen.getByRole("button", { name: /^Записать ·/ }));
    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(mockPost).toHaveBeenCalledWith("/appointments", { body: { clientId: "c1", serviceId: "s1", start: busy } });

    expect(await screen.findByText(conflictTitle("10:00"))).toBeOnTheScreen();
    const takenChip = screen.getByRole("button", { name: takenA11y("10:00") });
    expect(takenChip.props.accessibilityState).toMatchObject({ disabled: true });
    await waitFor(() => expect(slotRequests()).toBeGreaterThanOrEqual(2));

    await user.press(takenChip);
    await user.press(screen.getByRole("button", { name: CHOOSE_TIME }));
    expect(mockPost).toHaveBeenCalledTimes(1);

    await user.press(screen.getByText("11:30"));
    await user.press(screen.getByRole("button", { name: "Записать · сегодня, 11:30" }));
    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(2));
    expect(mockPost).toHaveBeenLastCalledWith("/appointments", { body: { clientId: "c1", serviceId: "s1", start: free } });

    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(getBookingNotice()?.appointmentId).toBe("a-new");
    expect(screen.queryByRole("button", { name: takenA11y("10:00") })).toBeNull();
  });

  it("never shows the new-client box while a known number is being checked", async () => {
    await render(
      <SafeAreaProvider
        initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}
      >
        <QueryClientProvider client={queryClient}>
          <NewAppointmentScreen />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );
    const user = userEvent.setup();
    const newClientBox = () => screen.queryByText(NEW_CLIENT_INFO_BOLD);

    await user.type(screen.getByLabelText(PHONE_STEP), "+998901234567");
    expect(newClientBox()).toBeNull();
    expect(await screen.findByText("Анна")).toBeOnTheScreen();
    expect(newClientBox()).toBeNull();
  });
});
