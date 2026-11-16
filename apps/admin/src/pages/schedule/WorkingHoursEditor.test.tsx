// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApi, unwrap } from "@/lib/api/client";
import { ApiError, type AppointmentConflict } from "@/lib/api/errors";
import { queryKeys } from "@/lib/data/queryKeys";
import type { WorkingBlock } from "@/lib/data/schedule";
import {
  DAY_PROBLEM_TEXT,
  HOURS_INTRO,
  HOURS_LOAD_FAILED,
  HOURS_TITLE,
  SAVE_OFFLINE_HINT,
  SAVED_TEXT,
  saveErrorText,
  toBlocks,
  toDraft,
} from "@/lib/data/workingHours";

import { WorkingHoursEditor } from "./WorkingHoursEditor";

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

const INITIAL_BLOCKS: WorkingBlock[] = [
  ...[1, 2, 3, 4, 5].flatMap((weekday) => [
    { weekday, start: "09:00", end: "13:00" },
    { weekday, start: "14:00", end: "19:00" },
  ]),
  { weekday: 6, start: "10:00", end: "15:00" },
];

const SETTINGS = { address: null, botEnabled: true, timeZone: "Asia/Tashkent" };

const CONFLICT: AppointmentConflict = {
  appointmentId: "a1",
  clientName: "Айгуль Сапарова",
  start: "2026-11-07T10:00:00+05:00",
  end: "2026-11-07T11:00:00+05:00",
};

function json(body: unknown, status = 200, contentType = "application/json"): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": contentType } });
}

function renderEditor() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <WorkingHoursEditor />
    </QueryClientProvider>,
  );
  return { queryClient };
}

function mockDefaultGets(putHandler?: (req: Request) => Promise<Response>) {
  respond.mockImplementation(async (req) => {
    const path = new URL(req.url).pathname;
    if (req.method === "GET" && path === "/settings") return json(SETTINGS);
    if (req.method === "GET" && path === "/working-hours") return json({ blocks: INITIAL_BLOCKS });
    if (req.method === "PUT" && path === "/working-hours" && putHandler) return putHandler(req);
    throw new Error(`Unexpected request: ${req.method} ${path}`);
  });
}

async function readPut(req: Request): Promise<{ blocks: WorkingBlock[]; force: boolean }> {
  return JSON.parse(await req.text()) as { blocks: WorkingBlock[]; force: boolean };
}

beforeEach(() => {
  respond.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("WorkingHoursEditor", () => {
  it("shows loading skeleton while initial queries are pending", () => {
    respond.mockImplementation(() => new Promise(() => {}));
    const { container } = (() => {
      renderEditor();
      return { container: document.body };
    })();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("shows load error on 500, retries on click, and shows network error when fetch rejects", async () => {
    let failGet = true;
    respond.mockImplementation(async (req) => {
      const path = new URL(req.url).pathname;
      if (path === "/settings") return json(SETTINGS);
      if (path === "/working-hours") {
        return failGet ? json({}, 500) : json({ blocks: INITIAL_BLOCKS });
      }
      throw new Error(`Unexpected ${path}`);
    });

    renderEditor();
    await waitFor(() => expect(screen.getByText(HOURS_LOAD_FAILED)).toBeTruthy());
    expect(screen.getByText("Сервер ответил с ошибкой. Код: 500.")).toBeTruthy();

    failGet = false;
    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: HOURS_TITLE })).toBeTruthy());

    cleanup();
    respond.mockRejectedValue(new TypeError("Failed to fetch"));
    renderEditor();
    await waitFor(() =>
      expect(screen.getByText("Нет связи с сервером. Проверьте интернет и нажмите «Повторить».")).toBeTruthy(),
    );
  });

  it("renders title, intro, 7 weekday groups, Sunday off, and disabled Save initially", async () => {
    mockDefaultGets();
    renderEditor();

    expect(await screen.findByRole("heading", { name: HOURS_TITLE })).toBeTruthy();
    expect(screen.getByText(HOURS_INTRO)).toBeTruthy();
    expect(screen.getAllByRole("group")).toHaveLength(7);

    const sunday = within(screen.getByRole("group", { name: "Воскресенье" }));
    expect(sunday.getByRole("checkbox", { name: "Выходной" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Сохранить" }).disabled).toBe(true);
  });

  it("enables Save after a valid edit and disables it on invalid day input", async () => {
    mockDefaultGets();
    renderEditor();
    await screen.findByRole("heading", { name: HOURS_TITLE });

    const saveButton = screen.getByRole<HTMLButtonElement>("button", { name: "Сохранить" });
    const monEnd1 = screen.getByLabelText<HTMLInputElement>("Понедельник, время 1: конец");
    fireEvent.change(monEnd1, { target: { value: "12:00" } });
    expect(saveButton.disabled).toBe(false);

    const monStart1 = screen.getByLabelText<HTMLInputElement>("Понедельник, время 1: начало");
    fireEvent.change(monStart1, { target: { value: "" } });
    expect(saveButton.disabled).toBe(true);
    expect(screen.getByText(DAY_PROBLEM_TEXT.empty)).toBeTruthy();
  });

  it("saves edited blocks with force=false, disables controls while pending, updates status, and clears status on next edit", async () => {
    const sent: Array<{ blocks: WorkingBlock[]; force: boolean }> = [];
    const expectedDraft = toDraft(INITIAL_BLOCKS);
    expectedDraft[0]![0]!.end = "12:00";
    const expectedBlocks = toBlocks(expectedDraft);

    let resolvePut!: (res: Response) => void;
    mockDefaultGets(async (req) => {
      const body = await readPut(req);
      sent.push(body);
      return new Promise((resolve) => {
        resolvePut = resolve;
      });
    });

    renderEditor();
    await screen.findByRole("heading", { name: HOURS_TITLE });

    const monEnd1 = screen.getByLabelText<HTMLInputElement>("Понедельник, время 1: конец");
    const sundayOff = within(screen.getByRole("group", { name: "Воскресенье" })).getByRole<HTMLButtonElement>(
      "checkbox",
      { name: "Выходной" },
    );
    fireEvent.change(monEnd1, { target: { value: "12:00" } });

    const saveButton = screen.getByRole<HTMLButtonElement>("button", { name: "Сохранить" });
    fireEvent.click(saveButton);

    await waitFor(() => expect(saveButton.disabled).toBe(true));
    expect(monEnd1.disabled).toBe(true);
    expect(sundayOff.disabled).toBe(true);

    await act(async () => {
      resolvePut(json({ blocks: sent[0]!.blocks }));
    });

    await waitFor(() => expect(screen.getByRole("status").textContent).toBe(SAVED_TEXT));
    expect(sent).toEqual([{ blocks: expectedBlocks, force: false }]);
    expect(saveButton.disabled).toBe(true);
    expect(monEnd1.disabled).toBe(false);

    fireEvent.change(monEnd1, { target: { value: "12:30" } });
    expect(screen.getByRole("status").textContent).toBe("");
    expect(saveButton.disabled).toBe(false);
  });

  it("opens conflict dialog on 409, confirms with force=true and same blocks, then focuses heading", async () => {
    const sent: Array<{ blocks: WorkingBlock[]; force: boolean }> = [];
    mockDefaultGets(async (req) => {
      const body = await readPut(req);
      sent.push(body);
      if (!body.force) {
        return json({ code: "APPOINTMENT_CONFLICT", conflicts: [CONFLICT] }, 409, "application/problem+json");
      }
      return json({ blocks: body.blocks });
    });

    renderEditor();
    const heading = await screen.findByRole("heading", { name: HOURS_TITLE });

    fireEvent.change(screen.getByLabelText("Понедельник, время 1: конец"), { target: { value: "12:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    const dialog = await screen.findByRole("dialog", { name: "Сохранить новые часы?" });
    expect(dialog).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Да, сохранить" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.getByRole("status").textContent).toBe(SAVED_TEXT);
      expect(document.activeElement).toBe(heading);
    });
    expect(sent).toHaveLength(2);
    expect(sent[0]?.force).toBe(false);
    expect(sent[1]?.force).toBe(true);
    expect(sent[1]?.blocks).toEqual(sent[0]?.blocks);
  });

  it("closes conflict dialog on cancel, preserves draft, and returns focus to Save without alert", async () => {
    const sent: Array<{ blocks: WorkingBlock[]; force: boolean }> = [];
    mockDefaultGets(async (req) => {
      const body = await readPut(req);
      sent.push(body);
      return json({ code: "APPOINTMENT_CONFLICT", conflicts: [CONFLICT] }, 409, "application/problem+json");
    });

    renderEditor();
    await screen.findByRole("heading", { name: HOURS_TITLE });

    const monEnd1 = screen.getByLabelText<HTMLInputElement>("Понедельник, время 1: конец");
    fireEvent.change(monEnd1, { target: { value: "12:00" } });
    const saveButton = screen.getByRole<HTMLButtonElement>("button", { name: "Сохранить" });
    fireEvent.click(saveButton);

    const dialog = await screen.findByRole("dialog", { name: "Сохранить новые часы?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Изменить часы" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.activeElement).toBe(saveButton);
    });
    expect(sent).toHaveLength(1);
    expect(monEnd1.value).toBe("12:00");
    expect(saveButton.disabled).toBe(false);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows offline error inside conflict dialog when force save fails with network error", async () => {
    mockDefaultGets(async (req) => {
      const body = await readPut(req);
      if (!body.force) {
        return json({ code: "APPOINTMENT_CONFLICT", conflicts: [CONFLICT] }, 409, "application/problem+json");
      }
      throw new TypeError("Failed to fetch");
    });

    renderEditor();
    await screen.findByRole("heading", { name: HOURS_TITLE });

    fireEvent.change(screen.getByLabelText("Понедельник, время 1: конец"), { target: { value: "12:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    const dialog = await screen.findByRole("dialog", { name: "Сохранить новые часы?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Да, сохранить" }));

    const alert = await within(dialog).findByRole("alert");
    expect(alert.textContent).toBe(saveErrorText("offline", new ApiError("network")));
  });

  it("shows 422 INVALID_HOURS and 500 errors in form alert", async () => {
    let status = 422;
    mockDefaultGets(async () =>
      status === 422 ? json({ code: "INVALID_HOURS" }, 422, "application/problem+json") : json({}, 500),
    );

    renderEditor();
    await screen.findByRole("heading", { name: HOURS_TITLE });

    fireEvent.change(screen.getByLabelText("Понедельник, время 1: конец"), { target: { value: "12:00" } });
    const saveButton = screen.getByRole<HTMLButtonElement>("button", { name: "Сохранить" });
    fireEvent.click(saveButton);

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(
        saveErrorText("invalid", new ApiError("problem", { status: 422, code: "INVALID_HOURS" })),
      ),
    );

    status = 500;
    fireEvent.click(saveButton);
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe("Сервер ответил с ошибкой. Код: 500. Часы не сохранены."),
    );
  });

  it("keeps Save disabled and shows offline hint after edits when offline, while fields stay editable", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    mockDefaultGets();
    renderEditor();
    await screen.findByRole("heading", { name: HOURS_TITLE });

    const monEnd1 = screen.getByLabelText<HTMLInputElement>("Понедельник, время 1: конец");
    expect(monEnd1.disabled).toBe(false);
    fireEvent.change(monEnd1, { target: { value: "12:00" } });
    expect(monEnd1.value).toBe("12:00");

    const saveButton = screen.getByRole<HTMLButtonElement>("button", { name: "Сохранить" });
    expect(saveButton.disabled).toBe(true);
    expect(screen.getByText(SAVE_OFFLINE_HINT)).toBeTruthy();
  });

  it("preserves unsaved edits when workingHours query cache updates in the background", async () => {
    mockDefaultGets();
    const { queryClient } = renderEditor();
    await screen.findByRole("heading", { name: HOURS_TITLE });

    const monEnd1 = screen.getByLabelText<HTMLInputElement>("Понедельник, время 1: конец");
    fireEvent.change(monEnd1, { target: { value: "12:00" } });

    act(() => {
      queryClient.setQueryData(queryKeys.workingHours, {
        blocks: [{ weekday: 1, start: "08:00", end: "16:00" }],
      });
    });

    expect(monEnd1.value).toBe("12:00");
  });
});
