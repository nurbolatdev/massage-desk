import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { components } from "@massage-desk/api-types";
import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import AppointmentScreen from "@/app/appointment/[id]";
import { ApiError } from "@/lib/api/errors";
import { CANCEL_CONFIRM_YES, CANCEL_LABEL } from "@/lib/data/appointmentCard";
import { RESCHEDULE_LABEL } from "@/lib/data/reschedule";
import { queryKeys } from "@/lib/data/queryKeys";
import { LOAD_ERROR_TEXT, REFRESH_FAILED_TITLE, RETRY_LABEL } from "@/lib/data/todayState";

type Call = (path: string, init?: unknown) => Promise<unknown>;

const mockGet = jest.fn<Call>();
const mockPost = jest.fn<Call>();
const mockPatch = jest.fn<Call>();
const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "a1", day: "2026-11-03" }),
  useRouter: () => ({ canGoBack: () => true, back: jest.fn(), replace: jest.fn(), push: mockPush }),
}));

jest.mock("@/lib/api", () => ({
  api: {
    GET: (path: string, init?: unknown) => mockGet(path, init),
    POST: (path: string, init?: unknown) => mockPost(path, init),
    PATCH: (path: string, init?: unknown) => mockPatch(path, init),
  },
  unwrap: jest.requireActual<typeof import("@/lib/api/client")>("@/lib/api/client").unwrap,
  ApiError: jest.requireActual<typeof import("@/lib/api/errors")>("@/lib/api/errors").ApiError,
}));

type Schemas = components["schemas"];

const DAY = "2026-11-03";
const START = "2026-11-03T10:00:00+05:00";
const END = "2026-11-03T11:00:00+05:00";

const settings: Schemas["SettingsResponse"] = { timeZone: "Asia/Tashkent", botEnabled: true, address: null };

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

const client: Schemas["ClientResponse"] = {
  id: "c1",
  name: "Анна",
  phone: "+998901234567",
  notes: null,
  createdAt: "2026-10-01T09:00:00+05:00",
};

const cancelled: Schemas["AppointmentResponse"] = {
  id: "a1",
  clientId: "c1",
  serviceId: "s1",
  start: START,
  end: END,
  status: "cancelled",
  source: "bot",
};

function ok(data: unknown) {
  return { data, response: new Response(null, { status: 200 }) };
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
});

function renderCard() {
  return render(
    <SafeAreaProvider
      initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}
    >
      <QueryClientProvider client={queryClient}>
        <AppointmentScreen />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

describe("appointment card screen", () => {
  beforeEach(() => {
    onlineManager.setOnline(true);
    mockGet.mockReset();
    mockPost.mockReset();
    mockPatch.mockReset();
    mockPush.mockReset();
    mockGet.mockImplementation(async (path) => {
      if (path === "/settings") return ok(settings);
      if (path === "/appointments") return ok([listItem]);
      if (path === "/clients/{id}") return ok(client);
      throw new Error(`unexpected GET ${path}`);
    });
    mockPost.mockResolvedValue(ok(cancelled));
    queryClient.setQueryData(queryKeys.settings, settings);
    queryClient.setQueryData(queryKeys.appointments.range(DAY, DAY), [listItem]);
    queryClient.setQueryData(queryKeys.clients.one("c1"), client);
  });

  afterEach(async () => {
    // Unmount before going back online, otherwise the mounted screen re-renders outside act().
    await cleanup();
    onlineManager.setOnline(true);
    queryClient.clear();
  });

  it("cancel sends one request, only after the confirmation", async () => {
    await render(
      <SafeAreaProvider
        initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}
      >
        <QueryClientProvider client={queryClient}>
          <AppointmentScreen />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );
    expect(screen.getByText("Анна")).toBeOnTheScreen();

    const user = userEvent.setup();
    await user.press(screen.getByRole("button", { name: CANCEL_LABEL }));
    expect(screen.queryByText(CANCEL_CONFIRM_YES)).not.toBeNull();
    expect(mockPost).not.toHaveBeenCalled();

    await user.press(screen.getByRole("button", { name: CANCEL_CONFIRM_YES }));
    await waitFor(() => expect(screen.queryByText(CANCEL_CONFIRM_YES)).toBeNull());

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith("/appointments/{id}/cancel", { params: { path: { id: "a1" } } });
  });

  it("opens the reschedule screen for a confirmed appointment", async () => {
    await renderCard();
    const user = userEvent.setup();
    await user.press(screen.getByRole("button", { name: RESCHEDULE_LABEL }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/reschedule/[id]", params: { id: "a1", day: DAY } });
  });

  it("has no reschedule button for a cancelled appointment", async () => {
    const cancelledItem = { ...listItem, status: "cancelled" as const };
    queryClient.setQueryData(queryKeys.appointments.range(DAY, DAY), [cancelledItem]);
    mockGet.mockImplementation(async (path) => {
      if (path === "/settings") return ok(settings);
      if (path === "/appointments") return ok([cancelledItem]);
      if (path === "/clients/{id}") return ok(client);
      throw new Error(`unexpected GET ${path}`);
    });
    await renderCard();
    expect(screen.queryByRole("button", { name: RESCHEDULE_LABEL })).toBeNull();
  });

  it("disables reschedule offline", async () => {
    onlineManager.setOnline(false);
    await renderCard();
    expect(screen.getByRole("button", { name: RESCHEDULE_LABEL })).toBeDisabled();
  });

  it("a failed settings refresh keeps the card without the refresh warning", async () => {
    queryClient.setQueryData(queryKeys.settings, settings, { updatedAt: Date.now() - 10 * 60 * 1000 });
    mockGet.mockImplementation(async (path) => {
      if (path === "/settings") throw new ApiError("server", { status: 500 });
      if (path === "/appointments") return ok([listItem]);
      if (path === "/clients/{id}") return ok(client);
      throw new Error(`unexpected GET ${path}`);
    });
    await renderCard();
    await waitFor(() => expect(queryClient.getQueryState(queryKeys.settings)?.status).toBe("error"));
    // Subscribers are notified on a later timer tick than the cache update.
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));

    expect(screen.getByText("Анна")).toBeOnTheScreen();
    expect(screen.queryByText(REFRESH_FAILED_TITLE)).toBeNull();
  });

  it("a failed list refresh shows the refresh warning", async () => {
    mockGet.mockImplementation(async (path) => {
      if (path === "/settings") return ok(settings);
      if (path === "/appointments") throw new ApiError("server", { status: 500 });
      if (path === "/clients/{id}") return ok(client);
      throw new Error(`unexpected GET ${path}`);
    });
    await renderCard();

    expect(await screen.findByText(REFRESH_FAILED_TITLE)).toBeOnTheScreen();
    expect(screen.getByText("Анна")).toBeOnTheScreen();
  });

  it("a settings failure before any data shows the load error with a retry", async () => {
    queryClient.removeQueries({ queryKey: queryKeys.settings });
    mockGet.mockImplementation(async (path) => {
      if (path === "/settings") throw new ApiError("server", { status: 500 });
      if (path === "/appointments") return ok([listItem]);
      if (path === "/clients/{id}") return ok(client);
      throw new Error(`unexpected GET ${path}`);
    });
    await renderCard();

    expect(await screen.findByText(LOAD_ERROR_TEXT)).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: RETRY_LABEL })).toBeOnTheScreen();
    expect(screen.queryByText(REFRESH_FAILED_TITLE)).toBeNull();
    expect(screen.queryByText("Анна")).toBeNull();
  });
});
