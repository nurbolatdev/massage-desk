// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApi, unwrap } from "@/lib/api/client";
import {
  HIDDEN_HINT,
  HIDE_SERVICE_LABEL,
  NAME_EMPTY,
  SAVE_SERVICE_LABEL,
  SHOW_SERVICE_LABEL,
  serviceSaveErrorText,
} from "@/lib/data/serviceForm";
import { formatAmount } from "@/lib/data/services";
import { SAVE_OFFLINE_HINT } from "@/lib/data/workingHours";

import { ServiceDialog } from "./ServiceDialog";

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

const back = { id: "s1", name: "Массаж спины", durationMin: 60, price: 8000, sortOrder: 1, active: true };
const hidden = { ...back, active: false };

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function setup(service: typeof back | null) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <ServiceDialog service={service} trigger={null} onClose={onClose} onSaved={onSaved} />
    </QueryClientProvider>,
  );
  return { onClose, onSaved };
}

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

async function body(call = 0) {
  return (await respond.mock.calls[call]?.[0].clone().json()) as unknown;
}

beforeEach(() => {
  respond.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ServiceDialog", () => {
  it("validates a new service and creates it", async () => {
    const created = { ...back, id: "s3", name: "Массаж рук", durationMin: 40, price: 7500 };
    respond.mockResolvedValue(json(created, 201));
    const { onSaved } = setup(null);
    expect(screen.getByRole("heading", { name: "Новая услуга" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: HIDE_SERVICE_LABEL })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: SAVE_SERVICE_LABEL }));
    const name = screen.getByLabelText("Название");
    expect(screen.getByText(NAME_EMPTY)).toBeTruthy();
    expect(name.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(name.getAttribute("aria-describedby") ?? "")?.textContent).toBe(NAME_EMPTY);
    expect(screen.getByLabelText("Длительность, мин").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByLabelText("Цена, ₸").getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(name);
    expect(respond).not.toHaveBeenCalled();

    type("Название", "  Массаж рук  ");
    type("Длительность, мин", "40");
    type("Цена, ₸", "7 500");
    fireEvent.click(screen.getByRole("button", { name: SAVE_SERVICE_LABEL }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(created, "saved"));
    expect(respond).toHaveBeenCalledTimes(1);
    expect(respond.mock.calls[0]?.[0].url).toBe("https://api.test/services");
    expect(await body()).toEqual({ name: "Массаж рук", durationMin: 40, price: 7500 });
  });

  it("sends only the changed price, and nothing when unchanged", async () => {
    respond.mockResolvedValue(json({ ...back, price: 9000 }));
    const { onSaved, onClose } = setup(back);
    expect(screen.getByRole("heading", { name: "Услуга" })).toBeTruthy();
    expect((screen.getByLabelText("Название") as HTMLInputElement).value).toBe("Массаж спины");
    expect((screen.getByLabelText("Длительность, мин") as HTMLInputElement).value).toBe("60");
    expect((screen.getByLabelText("Цена, ₸") as HTMLInputElement).value).toBe(formatAmount(8000));

    fireEvent.click(screen.getByRole("button", { name: SAVE_SERVICE_LABEL }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(respond).not.toHaveBeenCalled();

    type("Цена, ₸", "9000");
    fireEvent.click(screen.getByRole("button", { name: SAVE_SERVICE_LABEL }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ ...back, price: 9000 }, "saved"));
    expect(respond.mock.calls[0]?.[0].method).toBe("PATCH");
    expect(respond.mock.calls[0]?.[0].url).toBe("https://api.test/services/s1");
    expect(await body()).toEqual({ price: 9000 });
  });

  it("hides and shows a service", async () => {
    respond.mockResolvedValue(json(hidden));
    const first = setup(back);
    fireEvent.click(screen.getByRole("button", { name: HIDE_SERVICE_LABEL }));
    await waitFor(() => expect(first.onSaved).toHaveBeenCalledWith(hidden, "hidden"));
    expect(await body()).toEqual({ active: false });
    cleanup();

    respond.mockReset();
    respond.mockResolvedValue(json(back));
    const second = setup(hidden);
    expect(screen.getByText(HIDDEN_HINT)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: SHOW_SERVICE_LABEL }));
    await waitFor(() => expect(second.onSaved).toHaveBeenCalledWith(back, "shown"));
    expect(await body()).toEqual({ active: true });
  });

  it("shows save errors and keeps the dialog open", async () => {
    respond.mockResolvedValueOnce(json({ code: "INVALID_REQUEST" }, 400));
    const { onClose } = setup(back);
    type("Цена, ₸", "9000");
    fireEvent.click(screen.getByRole("button", { name: SAVE_SERVICE_LABEL }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(serviceSaveErrorText("invalid", null));
    expect((screen.getByLabelText("Цена, ₸") as HTMLInputElement).value).toBe("9000");
    expect(onClose).not.toHaveBeenCalled();

    respond.mockResolvedValueOnce(json({}, 500));
    fireEvent.click(screen.getByRole("button", { name: SAVE_SERVICE_LABEL }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(
        "Сервер ответил с ошибкой. Код: 500. Услуга не сохранена.",
      ),
    );

    respond.mockRejectedValueOnce(new TypeError("fail"));
    fireEvent.click(screen.getByRole("button", { name: SAVE_SERVICE_LABEL }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(serviceSaveErrorText("offline", null)),
    );
  });

  it("locks the dialog while saving", async () => {
    respond.mockReturnValue(new Promise<Response>(() => {}));
    const { onClose } = setup(back);
    type("Цена, ₸", "9000");
    fireEvent.click(screen.getByRole("button", { name: SAVE_SERVICE_LABEL }));
    await waitFor(() =>
      expect((screen.getByRole("button", { name: SAVE_SERVICE_LABEL }) as HTMLButtonElement).disabled).toBe(true),
    );
    expect((screen.getByRole("button", { name: "Отмена" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: HIDE_SERVICE_LABEL }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("blocks saving offline and explains why", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    setup(back);
    type("Цена, ₸", "9000");
    const saveButton = screen.getByRole("button", { name: SAVE_SERVICE_LABEL });
    const hide = screen.getByRole("button", { name: HIDE_SERVICE_LABEL });
    for (const button of [saveButton, hide]) {
      expect(button.getAttribute("aria-disabled")).toBe("true");
      const hint = document.getElementById(button.getAttribute("aria-describedby") ?? "");
      expect(hint?.textContent).toBe(SAVE_OFFLINE_HINT);
    }
    fireEvent.click(saveButton);
    fireEvent.click(hide);
    expect(respond).not.toHaveBeenCalled();
  });

  it("closes on Escape without a request", () => {
    const { onClose } = setup(back);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(respond).not.toHaveBeenCalled();
  });
});
