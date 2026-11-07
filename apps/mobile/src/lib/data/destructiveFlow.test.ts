import { describe, expect, it, jest } from "@jest/globals";

import type { AppointmentAction } from "./appointmentActions";
import { IDLE, createDestructiveFlow, type FlowState } from "./destructiveFlow";

const ERROR = "failed";

function setup(perform: (kind: AppointmentAction) => Promise<unknown>) {
  const spy = jest.fn(perform);
  const changes: FlowState[] = [];
  const flow = createDestructiveFlow({
    perform: spy,
    onChange: (s) => changes.push(s),
    errorText: () => ERROR,
  });
  return { flow, spy, changes };
}

describe("createDestructiveFlow", () => {
  it("opens the sheet on ask without performing", () => {
    const { flow, spy } = setup(() => Promise.resolve());
    flow.ask("cancel");
    expect(flow.state()).toEqual({ asking: "cancel", busy: false, error: null });
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns to idle on dismiss without performing", () => {
    const { flow, spy } = setup(() => Promise.resolve());
    flow.ask("noShow");
    flow.dismiss();
    expect(flow.state()).toEqual(IDLE);
    expect(spy).not.toHaveBeenCalled();
  });

  it("does nothing on confirm when nothing is asked", async () => {
    const { flow, spy } = setup(() => Promise.resolve());
    await flow.confirm();
    expect(spy).not.toHaveBeenCalled();
    expect(flow.state()).toEqual(IDLE);
  });

  it("performs once on confirm and goes idle after success", async () => {
    const { flow, spy } = setup(() => Promise.resolve());
    flow.ask("cancel");
    await flow.confirm();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("cancel");
    expect(flow.state()).toEqual(IDLE);
  });

  it("ignores a second confirm while the first is pending", async () => {
    let finish: () => void = () => undefined;
    const { flow, spy } = setup(() => new Promise<void>((resolve) => (finish = resolve)));
    flow.ask("cancel");
    const first = flow.confirm();
    await flow.confirm();
    expect(spy).toHaveBeenCalledTimes(1);
    finish();
    await first;
    expect(flow.state()).toEqual(IDLE);
  });

  it("ignores dismiss while busy", async () => {
    let finish: () => void = () => undefined;
    const { flow } = setup(() => new Promise<void>((resolve) => (finish = resolve)));
    flow.ask("noShow");
    const pending = flow.confirm();
    flow.dismiss();
    expect(flow.state()).toEqual({ asking: "noShow", busy: true, error: null });
    finish();
    await pending;
  });

  it("keeps the sheet open on failure and allows a retry", async () => {
    const { flow, spy } = setup(() => Promise.reject(new Error("boom")));
    flow.ask("cancel");
    await flow.confirm();
    expect(flow.state()).toEqual({ asking: "cancel", busy: false, error: ERROR });
    await flow.confirm();
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
