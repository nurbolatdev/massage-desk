// @vitest-environment jsdom
import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApi, unwrap } from "@/lib/api/client";
import {
  BUSINESS_TITLE,
  HOURS_HINT,
  SAVED_SETTINGS,
  SETTINGS_LOAD_FAILED,
  SETTINGS_OFFLINE,
  ZONE_CONFIRM_TITLE,
  ZONE_CONFLICT_LIST_LABEL,
  ZONE_HINT,
  settingsSaveErrorText,
  zoneConfirmText,
  zoneConflictText,
} from "@/lib/data/businessSettings";
import { queryKeys } from "@/lib/data/queryKeys";
import { slotLines } from "@/lib/data/reschedule";
import { SAVE_OFFLINE_HINT } from "@/lib/data/workingHours";
import { ApiError } from "@/lib/api/errors";

import { BusinessSettingsSection } from "./BusinessSettingsSection";

const respond = vi.hoisted(() => vi.fn<(r: Request) => Promise<Response>>());

vi.mock("@/lib/api", () => ({
  api: createApi({
    baseUrl: "https://api.test",
    getAccessToken: async () => "tok",
    onUnauthorized: () => {},
    fetch: (r) => respond(r),
  }),
  unwrap,
}));

const settings = { timeZone: "Asia/Almaty", address: "ул. Абая, 1", botEnabled: true };
const conflicts = [
  { appointmentId: "a2", clientName: null, start: "2026-11-19T10:00:00Z", end: "2026-11-19T11:00:00Z" },
  { appointmentId: "a1", clientName: "Айгуль", start: "2026-11-18T10:00:00Z", end: "2026-11-18T11:00:00Z" },
];

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}

type Patch = Record<string, unknown>;
const patches: Patch[] = [];

/** GET /settings answers `current`; PATCH answers the queued replies in order, then echoes the body. */
function serve(replies: (Response | Promise<Response> | Error)[] = [], current: unknown = settings) {
  patches.length = 0;
  respond.mockImplementation(async (r) => {
    if (r.method === "GET") return json(current);
    const body = (await r.clone().json()) as Patch;
    expect(body).not.toHaveProperty("botEnabled");
    patches.push(body);
    const reply = replies.shift();
    if (reply instanceof Error) throw reply;
    return reply ?? json({ ...settings, ...body, force: undefined });
  });
}

function renderSection() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <BusinessSettingsSection />
    </QueryClientProvider>,
  );
}

async function renderReady() {
  const view = renderSection();
  await screen.findByLabelText("Адрес");
  return view;
}

const address = () => screen.getByLabelText<HTMLInputElement>("Адрес");
const save = () => screen.getByRole<HTMLButtonElement>("button", { name: "Сохранить" });
const zone = (name: RegExp) => screen.getByRole<HTMLInputElement>("radio", { name });

beforeEach(() => {
  respond.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  onlineManager.setOnline(true);
});

describe("BusinessSettingsSection states", () => {
  it("shows the title and a skeleton while loading", () => {
    respond.mockReturnValue(new Promise(() => {}));
    const { container } = renderSection();
    expect(screen.getByRole("heading", { level: 2, name: BUSINESS_TITLE })).not.toBeNull();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("shows a load failure and retries", async () => {
    respond.mockResolvedValueOnce(json({ code: "X" }, 500));
    renderSection();
    expect((await screen.findByRole("alert")).textContent).toContain(SETTINGS_LOAD_FAILED);
    serve();
    fireEvent.click(screen.getByRole("button", { name: /Повторить/ }));
    expect(await screen.findByLabelText("Адрес")).not.toBeNull();
  });

  it("shows an offline note without data and sends nothing", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    onlineManager.setOnline(false);
    renderSection();
    expect(screen.getByRole("status").textContent).toBe(SETTINGS_OFFLINE);
    expect(respond).not.toHaveBeenCalled();
  });

  it("shows the form with the saved values and a disabled save button", async () => {
    serve();
    await renderReady();
    expect(address().value).toBe("ул. Абая, 1");
    const group = screen.getByRole("group", { name: "Часовой пояс" });
    expect(group.getAttribute("aria-describedby")).toBe(screen.getByText(ZONE_HINT).id);
    const radios = within(group).getAllByRole<HTMLInputElement>("radio");
    expect(radios).toHaveLength(4);
    expect(radios.map((r) => r.checked)).toEqual([true, false, false, false]);
    expect(radios[0]?.getAttribute("name")).toBe(radios[3]?.getAttribute("name"));
    expect(screen.getByText(HOURS_HINT)).not.toBeNull();
    expect(save().disabled).toBe(true);
  });

  it("adds a fifth checked option for a zone outside the list", async () => {
    serve([], { ...settings, timeZone: "Europe/Berlin" });
    await renderReady();
    const radios = screen.getAllByRole<HTMLInputElement>("radio");
    expect(radios).toHaveLength(5);
    expect(radios[4]?.checked).toBe(true);
    expect(radios[4]?.closest("label")?.textContent).toContain("Europe/Berlin");
  });
});

describe("BusinessSettingsSection saving", () => {
  it("saves only the address without a dialog", async () => {
    serve();
    await renderReady();
    fireEvent.change(address(), { target: { value: "ул. Абая, 2" } });
    fireEvent.click(save());
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe(SAVED_SETTINGS));
    expect(patches).toEqual([{ address: "ул. Абая, 2" }]);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 2 }));
    expect(save().disabled).toBe(true);
  });

  it("keeps the edited zone and takes a new address from the server", async () => {
    serve();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <BusinessSettingsSection />
      </QueryClientProvider>,
    );
    await screen.findByLabelText("Адрес");
    fireEvent.click(zone(/^Москва/));
    act(() => {
      client.setQueryData(queryKeys.settings, { ...settings, address: "Новый адрес" });
    });
    await waitFor(() => expect(address().value).toBe("Новый адрес"));
    expect(zone(/^Москва/).checked).toBe(true);
  });

  it("clears the address with an empty string", async () => {
    serve();
    await renderReady();
    fireEvent.change(address(), { target: { value: "  " } });
    fireEvent.click(save());
    await waitFor(() => expect(patches).toEqual([{ address: "" }]));
  });

  it("asks before changing the zone and keeps the choice on cancel", async () => {
    serve();
    await renderReady();
    fireEvent.click(zone(/^Москва/));
    fireEvent.click(save());
    const dialog = await screen.findByRole("dialog", { name: ZONE_CONFIRM_TITLE });
    expect(within(dialog).getByText(zoneConfirmText("Москва (UTC+3)"))).not.toBeNull();
    expect(within(dialog).queryByRole("list")).toBeNull();
    expect(patches).toEqual([]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Отмена" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(patches).toEqual([]);
    expect(document.activeElement).toBe(save());
    expect(zone(/^Москва/).checked).toBe(true);
  });

  it("changes the zone after confirmation", async () => {
    serve();
    await renderReady();
    fireEvent.click(zone(/^Москва/));
    fireEvent.click(save());
    fireEvent.click(await screen.findByRole("button", { name: "Да, сменить" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(patches).toEqual([{ timeZone: "Europe/Moscow" }]);
    expect(screen.getByRole("status").textContent).toBe(SAVED_SETTINGS);
    expect(zone(/^Москва/).checked).toBe(true);
    expect(save().disabled).toBe(true);
  });

  it("sends the address and the zone in one request", async () => {
    serve();
    await renderReady();
    fireEvent.change(address(), { target: { value: "Новый адрес" } });
    fireEvent.click(zone(/^Ташкент/));
    fireEvent.click(save());
    fireEvent.click(await screen.findByRole("button", { name: "Да, сменить" }));
    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches).toEqual([{ address: "Новый адрес", timeZone: "Asia/Tashkent" }]);
  });

  it("lists conflicts in the same dialog and repeats with force", async () => {
    serve([
      json({ code: "APPOINTMENT_CONFLICT", conflicts }, 409),
    ]);
    await renderReady();
    fireEvent.click(zone(/^Москва/));
    fireEvent.click(save());
    fireEvent.click(await screen.findByRole("button", { name: "Да, сменить" }));
    const list = await screen.findByRole("list", { name: ZONE_CONFLICT_LIST_LABEL });
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(zoneConflictText(2))).not.toBeNull();
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    const first = slotLines(new Date(conflicts[1]?.start ?? ""), new Date(conflicts[1]?.end ?? ""), "Europe/Moscow");
    expect(items[0]?.textContent).toContain(`${first.day}, ${first.time}`);
    fireEvent.click(within(dialog).getByRole("button", { name: "Да, сменить" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(patches).toEqual([{ timeZone: "Europe/Moscow" }, { timeZone: "Europe/Moscow", force: true }]);
  });
});

describe("BusinessSettingsSection errors", () => {
  it("shows an invalid address error under the form and keeps the input", async () => {
    serve([json({ code: "INVALID_REQUEST" }, 400)]);
    await renderReady();
    fireEvent.change(address(), { target: { value: "Другой адрес" } });
    fireEvent.click(save());
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(settingsSaveErrorText("invalid", null));
    expect(address().value).toBe("Другой адрес");
    fireEvent.change(address(), { target: { value: "Другой адрес 2" } });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows an unknown zone error inside the dialog", async () => {
    serve([json({ code: "UNKNOWN_TIME_ZONE" }, 400)]);
    await renderReady();
    fireEvent.click(zone(/^Москва/));
    fireEvent.click(save());
    fireEvent.click(await screen.findByRole("button", { name: "Да, сменить" }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(within(dialog).getByRole("alert").textContent).toBe(settingsSaveErrorText("unknownZone", null)));
  });

  it("shows the status code of a server error", async () => {
    serve([json({}, 500)]);
    await renderReady();
    fireEvent.change(address(), { target: { value: "x" } });
    fireEvent.click(save());
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Сервер ответил с ошибкой. Код: 500. Настройки не сохранены.",
    );
  });

  it("shows the offline text when the request fails to reach the server", async () => {
    serve([new TypeError("failed")]);
    await renderReady();
    fireEvent.change(address(), { target: { value: "x" } });
    fireEvent.click(save());
    expect((await screen.findByRole("alert")).textContent).toBe(
      settingsSaveErrorText("offline", new ApiError("network")),
    );
  });
});

describe("BusinessSettingsSection busy and offline", () => {
  it("locks the form and the dialog while saving", async () => {
    serve([new Promise<Response>(() => {})]);
    await renderReady();
    fireEvent.click(zone(/^Москва/));
    fireEvent.click(save());
    fireEvent.click(await screen.findByRole("button", { name: "Да, сменить" }));
    await waitFor(() => expect(patches).toHaveLength(1));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole<HTMLButtonElement>("button", { name: "Да, сменить" }).disabled).toBe(true);
    expect(within(dialog).getByRole<HTMLButtonElement>("button", { name: "Отмена" }).disabled).toBe(true);
    expect(address().readOnly).toBe(true);
    expect(screen.getAllByRole<HTMLInputElement>("radio", { hidden: true }).every((r) => r.disabled)).toBe(true);
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeNull();
  });

  it("does not send or ask while offline", async () => {
    serve();
    await renderReady();
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    fireEvent(window, new Event("offline"));
    fireEvent.click(zone(/^Москва/));
    await waitFor(() => expect(save().getAttribute("aria-disabled")).toBe("true"));
    expect(save().getAttribute("aria-describedby")).toBe(screen.getByText(SAVE_OFFLINE_HINT).id);
    fireEvent.click(save());
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(patches).toEqual([]);
  });
});
