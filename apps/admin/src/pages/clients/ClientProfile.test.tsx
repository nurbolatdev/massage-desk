// @vitest-environment jsdom
import { createRef, type Ref } from "react";
import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApi, unwrap } from "@/lib/api/client";
import {
  NOTE_FIELD_LABEL,
  NOTE_LOAD_FAILED,
  NOTE_OFFLINE,
  PICK_CLIENT,
  PROFILE_LABEL,
  type Client,
} from "@/lib/data/clients";

import { ClientProfile } from "./ClientProfile";

const respond = vi.hoisted(() => vi.fn<(r: Request) => Promise<Response>>());
const clientReply = vi.hoisted(() => vi.fn<(r: Request) => Promise<Response>>());

vi.mock("@/lib/api", () => ({
  api: createApi({
    baseUrl: "https://api.test",
    getAccessToken: async () => "tok",
    onUnauthorized: () => {},
    fetch: (r) => respond(r),
  }),
  unwrap,
}));

function makeClient(over: Partial<Client> = {}): Client {
  return {
    id: "c1",
    phone: "+77012345678",
    name: "Айгуль Сапарова",
    notes: null,
    createdAt: "2025-10-12T10:00:00+05:00",
    ...over,
  };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderProfile(client: Client | null, nameRef?: Ref<HTMLHeadingElement>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ClientProfile client={client} nameRef={nameRef} />
    </QueryClientProvider>,
  );
  return {
    ...view,
    rerenderProfile: (next: Client | null, nextRef?: Ref<HTMLHeadingElement>) =>
      view.rerender(
        <QueryClientProvider client={queryClient}>
          <ClientProfile client={next} nameRef={nextRef} />
        </QueryClientProvider>,
      ),
  };
}

beforeEach(() => {
  clientReply.mockReset();
  respond.mockReset();
  respond.mockImplementation((req) => {
    const path = new URL(req.url).pathname;
    if (path.endsWith("/stats")) {
      return Promise.resolve(
        jsonResponse({
          visits: 0,
          totalSpent: 0,
          noShows: 0,
          lastVisitAt: null,
          nextAppointmentAt: null,
          visitIntervalDays: null,
        }),
      );
    }
    if (path.endsWith("/appointments")) return Promise.resolve(jsonResponse([]));
    return clientReply(req);
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  onlineManager.setOnline(true);
});

describe("ClientProfile", () => {
  it("shows pick prompt and makes no requests when no client is selected", () => {
    renderProfile(null);

    const aside = screen.getByRole("complementary", { name: PROFILE_LABEL });
    expect(aside.textContent).toContain(PICK_CLIENT);
    expect(clientReply).not.toHaveBeenCalled();
  });

  it("renders header immediately from row, shows skeleton while loading, then displays fresh note from GET", async () => {
    let resolveGet!: (res: Response) => void;
    clientReply.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveGet = resolve;
        }),
    );

    const { container } = renderProfile(
      makeClient({ name: "Айгуль Сапарова", notes: "старая" }),
    );

    const heading = screen.getByRole("heading", { name: "Айгуль Сапарова" });
    expect(heading.tagName).toBe("H2");
    expect(screen.getByText("+77012345678")).toBeDefined();
    expect(screen.getByText("Клиент с 12 окт. 2025 г.")).toBeDefined();
    expect(screen.getByText("АС")).toBeDefined();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();

    await waitFor(() => expect(clientReply).toHaveBeenCalledTimes(1));
    resolveGet(jsonResponse(makeClient({ name: "Айгуль Сапарова", notes: "свежая" })));

    const field = (await screen.findByLabelText(NOTE_FIELD_LABEL)) as HTMLTextAreaElement;
    expect(field.value).toBe("свежая");
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
    expect(clientReply).toHaveBeenCalledTimes(1);
    expect(clientReply.mock.calls[0]?.[0].method).toBe("GET");
    expect(clientReply.mock.calls[0]?.[0].url).toBe("https://api.test/clients/c1");
  });

  it("shows phone once as heading and renders fallback icon instead of initials when name is null", async () => {
    const client = makeClient({ id: "c-null", name: null, phone: "+77025550134", notes: "" });
    clientReply.mockResolvedValueOnce(jsonResponse(client));

    const { container } = renderProfile(client);

    expect(screen.getByRole("heading", { name: "+77025550134" })).toBeDefined();
    expect(screen.getAllByText("+77025550134")).toHaveLength(1);
    expect(container.querySelector("span[aria-hidden='true'] svg")).not.toBeNull();
    await screen.findByLabelText(NOTE_FIELD_LABEL);
  });

  it("shows server error alert with retry button that reloads the note, and network error text on rejected fetch", async () => {
    clientReply.mockResolvedValueOnce(jsonResponse({ message: "fail" }, 500));

    renderProfile(makeClient());

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(NOTE_LOAD_FAILED);
    expect(alert.textContent).toContain("Сервер ответил с ошибкой. Код: 500.");

    const retry = screen.getByRole("button", { name: "Повторить" });
    expect(document.getElementById(retry.getAttribute("aria-describedby") ?? "")?.textContent).toBe(
      NOTE_LOAD_FAILED,
    );

    clientReply.mockResolvedValueOnce(jsonResponse(makeClient({ notes: "после повтора" })));
    fireEvent.click(retry);

    const field = (await screen.findByLabelText(NOTE_FIELD_LABEL)) as HTMLTextAreaElement;
    expect(field.value).toBe("после повтора");

    cleanup();
    clientReply.mockRejectedValueOnce(new TypeError("network down"));

    renderProfile(makeClient({ id: "c2" }));
    const networkAlert = await screen.findByRole("alert");
    expect(networkAlert.textContent).toContain(NOTE_LOAD_FAILED);
    expect(networkAlert.textContent).toContain(
      "Нет связи с сервером. Проверьте интернет и нажмите «Повторить».",
    );
  });

  it("shows offline status with no requests when offline without cache, and loads note when back online", async () => {
    onlineManager.setOnline(false);
    const onLineSpy = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);

    renderProfile(makeClient());

    expect(screen.getAllByRole("status").map((el) => el.textContent)).toContain(NOTE_OFFLINE);
    expect(clientReply).not.toHaveBeenCalled();

    clientReply.mockResolvedValueOnce(jsonResponse(makeClient({ notes: "онлайн заметка" })));
    onLineSpy.mockReturnValue(true);
    onlineManager.setOnline(true);

    const field = (await screen.findByLabelText(NOTE_FIELD_LABEL)) as HTMLTextAreaElement;
    expect(field.value).toBe("онлайн заметка");
    expect(clientReply).toHaveBeenCalledTimes(1);
  });

  it("resets unsaved note draft when switching to another client", async () => {
    const c1 = makeClient({ id: "c1", name: "Айгуль Сапарова", notes: "первая" });
    const c2 = makeClient({ id: "c2", name: "Ержан Бекенов", notes: "вторая" });
    clientReply.mockResolvedValueOnce(jsonResponse(c1));

    const { rerenderProfile } = renderProfile(c1);
    const firstField = (await screen.findByLabelText(NOTE_FIELD_LABEL)) as HTMLTextAreaElement;
    fireEvent.change(firstField, { target: { value: "несохранённый черновик" } });

    clientReply.mockResolvedValueOnce(jsonResponse(c2));
    rerenderProfile(c2);

    await waitFor(async () => {
      const secondField = (await screen.findByLabelText(NOTE_FIELD_LABEL)) as HTMLTextAreaElement;
      expect(secondField.value).toBe("вторая");
    });
  });

  it("forwards nameRef to h2 heading so it can receive focus, and omits the chat link", async () => {
    const client = makeClient({ notes: "заметка" });
    clientReply.mockResolvedValueOnce(jsonResponse(client));
    const nameRef = createRef<HTMLHeadingElement>();

    const { container } = renderProfile(client, nameRef);
    await screen.findByLabelText(NOTE_FIELD_LABEL);

    expect(nameRef.current?.tagName).toBe("H2");
    nameRef.current?.focus();
    expect(document.activeElement).toBe(nameRef.current);

    expect(container.textContent).not.toContain("Открыть переписку");
  });
});
