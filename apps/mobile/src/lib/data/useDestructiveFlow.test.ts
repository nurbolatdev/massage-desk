import { describe, expect, it, jest } from "@jest/globals";
import { act, renderHook } from "@testing-library/react-native";

import { ApiError } from "@/lib/api/errors";

import type { AppointmentAction } from "./appointmentActions";
import { ACTION_CONFLICT, ACTION_FAILED } from "./appointmentCard";
import { IDLE } from "./destructiveFlow";
import { useDestructiveFlow } from "./useDestructiveFlow";

type Perform = (kind: AppointmentAction) => Promise<unknown>;

async function setup(perform: Perform) {
  const hook = await renderHook(({ fn }: { fn: Perform }) => useDestructiveFlow(fn), {
    initialProps: { fn: perform },
  });
  const ask = async (kind: AppointmentAction) => {
    await act(async () => hook.result.current.ask(kind));
  };
  const confirm = async () => {
    await act(async () => {
      await hook.result.current.confirm();
    });
  };
  return { hook, ask, confirm };
}

describe("useDestructiveFlow", () => {
  it("opens the sheet on ask without performing", async () => {
    const perform = jest.fn<Perform>();
    const { hook, ask } = await setup(perform);
    await ask("cancel");
    expect(hook.result.current.state).toEqual({ asking: "cancel", busy: false, error: null });
    expect(perform).not.toHaveBeenCalled();
  });

  it.each<AppointmentAction>(["cancel", "noShow"])("performs %s once on confirm", async (kind) => {
    const perform = jest.fn<Perform>().mockResolvedValue(undefined);
    const { hook, ask, confirm } = await setup(perform);
    await ask(kind);
    await confirm();
    expect(perform).toHaveBeenCalledTimes(1);
    expect(perform).toHaveBeenCalledWith(kind);
    expect(hook.result.current.state).toEqual(IDLE);
  });

  it("keeps the sheet open with the text on failure and allows a retry", async () => {
    const perform = jest.fn<Perform>().mockRejectedValueOnce(new Error("boom"));
    const { hook, ask, confirm } = await setup(perform);
    await ask("cancel");
    await confirm();
    expect(hook.result.current.state).toEqual({ asking: "cancel", busy: false, error: ACTION_FAILED });
    perform.mockResolvedValueOnce(undefined);
    await confirm();
    expect(perform).toHaveBeenCalledTimes(2);
    expect(perform).toHaveBeenNthCalledWith(1, "cancel");
    expect(perform).toHaveBeenNthCalledWith(2, "cancel");
    expect(hook.result.current.state).toEqual(IDLE);
  });

  it("shows the conflict text for a 409", async () => {
    const perform = jest.fn<Perform>().mockRejectedValueOnce(new ApiError("problem", { status: 409 }));
    const { hook, ask, confirm } = await setup(perform);
    await ask("cancel");
    await confirm();
    expect(hook.result.current.state.error).toBe(ACTION_CONFLICT);
  });

  it("uses the latest perform after a rerender", async () => {
    const first = jest.fn<Perform>().mockResolvedValue(undefined);
    const second = jest.fn<Perform>().mockResolvedValue(undefined);
    const { hook, ask, confirm } = await setup(first);
    await hook.rerender({ fn: second });
    await ask("cancel");
    await confirm();
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  it("uses a custom error text and a custom kind, and closes when perform resolves", async () => {
    type Kind = "reschedule";
    const perform = jest.fn<(kind: Kind) => Promise<unknown>>().mockRejectedValueOnce(new Error("boom"));
    const hook = await renderHook(() => useDestructiveFlow<Kind>(perform, () => "custom text"));
    await act(async () => hook.result.current.ask("reschedule"));
    await act(async () => {
      await hook.result.current.confirm();
    });
    expect(hook.result.current.state).toEqual({ asking: "reschedule", busy: false, error: "custom text" });
    perform.mockResolvedValueOnce(undefined);
    await act(async () => {
      await hook.result.current.confirm();
    });
    expect(hook.result.current.state).toEqual(IDLE);
  });
});
