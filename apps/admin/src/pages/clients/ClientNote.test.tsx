// @vitest-environment jsdom
import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApi, unwrap } from "@/lib/api/client";
import {
  NOTE_FIELD_LABEL,
  NOTE_MAX_LENGTH,
  NOTE_SAVED,
  NOTE_SAVE_FAILED,
  NOTE_SAVE_LABEL,
  NOTE_SAVE_OFFLINE,
  type Client,
} from "@/lib/data/clients";

import { ClientNote } from "./ClientNote";

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

function makeClient(notes: string | null = null): Client {
  return {
    id: "c1",
    phone: "+77012345678",
    name: "Айгуль Сапарова",
    notes,
    createdAt: "2025-10-12T10:00:00+05:00",
  };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderNote(client: Client) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ClientNote client={client} />
    </QueryClientProvider>,
  );
  return {
    ...view,
    rerenderNote: (next: Client) =>
      view.rerender(
        <QueryClientProvider client={queryClient}>
          <ClientNote client={next} />
        </QueryClientProvider>,
      ),
  };
}

beforeEach(() => {
  respond.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  onlineManager.setOnline(true);
});

describe("ClientNote", () => {
  it("renders note field with label, value, maxLength and no Save button initially", () => {
    renderNote(makeClient("Аллергия на масло"));

    const field = screen.getByLabelText(NOTE_FIELD_LABEL) as HTMLTextAreaElement;
    expect(field.value).toBe("Аллергия на масло");
    expect(field.maxLength).toBe(NOTE_MAX_LENGTH);
    expect(screen.queryByRole("button", { name: NOTE_SAVE_LABEL })).toBeNull();
  });

  it("renders empty string when notes is null and hides history/visits blocks", () => {
    const { container } = renderNote(makeClient(null));

    const field = screen.getByLabelText(NOTE_FIELD_LABEL) as HTMLTextAreaElement;
    expect(field.value).toBe("");
    expect(container.textContent).not.toContain("История");
    expect(container.textContent).not.toContain("визитов");
  });

  it("shows Save button on edit and hides it when reverted to saved text", () => {
    renderNote(makeClient("Исходная"));
    const field = screen.getByLabelText(NOTE_FIELD_LABEL);

    fireEvent.change(field, { target: { value: "Изменённая" } });
    expect(screen.getByRole("button", { name: NOTE_SAVE_LABEL })).toBeDefined();

    fireEvent.change(field, { target: { value: "Исходная" } });
    expect(screen.queryByRole("button", { name: NOTE_SAVE_LABEL })).toBeNull();
  });

  it("saves edited note via PATCH, updates field from response, shows status and focuses field", async () => {
    const saved = makeClient("Болит шея");
    respond.mockResolvedValueOnce(jsonResponse(saved));

    renderNote(makeClient(null));
    const field = screen.getByLabelText(NOTE_FIELD_LABEL) as HTMLTextAreaElement;

    fireEvent.change(field, { target: { value: "Болит шея  " } });
    fireEvent.click(screen.getByRole("button", { name: NOTE_SAVE_LABEL }));

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe(NOTE_SAVED);
    });

    const req = respond.mock.calls[0]?.[0];
    expect(req?.method).toBe("PATCH");
    expect(req?.url).toBe("https://api.test/clients/c1");
    expect(await req?.json()).toEqual({ notes: "Болит шея  " });

    expect(field.value).toBe("Болит шея");
    expect(screen.queryByRole("button", { name: NOTE_SAVE_LABEL })).toBeNull();
    expect(document.activeElement).toBe(field);
  });

  it("does not show the saved status again after typing and reverting", async () => {
    respond.mockResolvedValueOnce(jsonResponse(makeClient("Болит шея")));

    renderNote(makeClient(null));
    const field = screen.getByLabelText(NOTE_FIELD_LABEL) as HTMLTextAreaElement;

    fireEvent.change(field, { target: { value: "Болит шея" } });
    fireEvent.click(screen.getByRole("button", { name: NOTE_SAVE_LABEL }));
    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe(NOTE_SAVED);
    });

    fireEvent.change(field, { target: { value: "Болит шея!" } });
    fireEvent.change(field, { target: { value: "Болит шея" } });

    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("clears note when saving empty string and server returns notes: null", async () => {
    respond.mockResolvedValueOnce(jsonResponse(makeClient(null)));

    renderNote(makeClient("Старая заметка"));
    const field = screen.getByLabelText(NOTE_FIELD_LABEL) as HTMLTextAreaElement;

    fireEvent.change(field, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: NOTE_SAVE_LABEL }));

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe(NOTE_SAVED);
    });

    expect(await respond.mock.calls[0]?.[0].json()).toEqual({ notes: "" });
    expect(field.value).toBe("");
    expect(screen.queryByRole("button", { name: NOTE_SAVE_LABEL })).toBeNull();
  });

  it("keeps field readOnly and prevents duplicate PATCH while saving", async () => {
    let resolvePatch!: (res: Response) => void;
    respond.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolvePatch = resolve;
        }),
    );

    renderNote(makeClient(null));
    const field = screen.getByLabelText(NOTE_FIELD_LABEL) as HTMLTextAreaElement;

    fireEvent.change(field, { target: { value: "В процессе" } });
    const button = screen.getByRole("button", { name: NOTE_SAVE_LABEL });
    fireEvent.click(button);

    await waitFor(() => {
      expect(field.readOnly).toBe(true);
      expect(button.getAttribute("aria-disabled")).toBe("true");
    });

    fireEvent.click(button);
    expect(respond).toHaveBeenCalledTimes(1);

    resolvePatch(jsonResponse(makeClient("В процессе")));
    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe(NOTE_SAVED);
    });
    expect(field.readOnly).toBe(false);
  });

  it("shows server error alert and preserves draft on 500, and network error alert on rejected fetch", async () => {
    respond.mockResolvedValueOnce(jsonResponse({ message: "fail" }, 500));

    renderNote(makeClient(null));
    const field = screen.getByLabelText(NOTE_FIELD_LABEL) as HTMLTextAreaElement;

    fireEvent.change(field, { target: { value: "Мой черновик" } });
    fireEvent.click(screen.getByRole("button", { name: NOTE_SAVE_LABEL }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe(
        "Сервер ответил с ошибкой. Код: 500. Заметка не сохранена.",
      );
    });
    expect(field.value).toBe("Мой черновик");
    const button = screen.getByRole("button", { name: NOTE_SAVE_LABEL });
    expect(button.getAttribute("aria-disabled")).toBe("false");

    respond.mockRejectedValueOnce(new TypeError("network down"));
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe(NOTE_SAVE_FAILED);
    });
    expect(field.value).toBe("Мой черновик");
  });

  it("disables Save button with offline hint and sends no requests when offline", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);

    renderNote(makeClient(null));
    const field = screen.getByLabelText(NOTE_FIELD_LABEL);

    fireEvent.change(field, { target: { value: "Офлайн-текст" } });
    const button = screen.getByRole("button", { name: NOTE_SAVE_LABEL });
    expect(button.getAttribute("aria-disabled")).toBe("true");

    const describedBy = button.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy ?? "")?.textContent).toBe(NOTE_SAVE_OFFLINE);

    fireEvent.click(button);
    expect(respond).not.toHaveBeenCalled();
  });

  it("tracks updated client.notes when unedited, and keeps draft when edited", () => {
    const { rerenderNote } = renderNote(makeClient("Первая"));
    const field = screen.getByLabelText(NOTE_FIELD_LABEL) as HTMLTextAreaElement;

    rerenderNote(makeClient("Вторая"));
    expect(field.value).toBe("Вторая");
    expect(screen.queryByRole("button", { name: NOTE_SAVE_LABEL })).toBeNull();

    fireEvent.change(field, { target: { value: "Черновик" } });
    rerenderNote(makeClient("Третья"));
    expect(field.value).toBe("Черновик");
    expect(screen.getByRole("button", { name: NOTE_SAVE_LABEL })).toBeDefined();
  });
});
