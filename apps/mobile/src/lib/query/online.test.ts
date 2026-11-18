import { describe, expect, it, jest } from "@jest/globals";
import { onlineManager } from "@tanstack/react-query";

import { getOnlineSnapshot, subscribeOnline } from "./online";

describe("online snapshot functions", () => {
  it("read the manager state without throwing when detached", () => {
    onlineManager.setOnline(true);
    expect(getOnlineSnapshot()).toBe(true);
    onlineManager.setOnline(false);
    expect(getOnlineSnapshot()).toBe(false);
    onlineManager.setOnline(true);
  });

  it("subscribe notifies about changes and unsubscribes", () => {
    const listener = jest.fn();
    const unsubscribe = subscribeOnline(listener);
    onlineManager.setOnline(false);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    onlineManager.setOnline(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
