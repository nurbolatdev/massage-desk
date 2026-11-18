import { describe, expect, it } from "@jest/globals";

import { isOnlineState } from "./onlineLogic";

describe("isOnlineState", () => {
  it("is online when connected and reachable or reachability is unknown", () => {
    expect(isOnlineState({ isConnected: true, isInternetReachable: true })).toBe(true);
    expect(isOnlineState({ isConnected: true, isInternetReachable: null })).toBe(true);
    expect(isOnlineState({ isConnected: null, isInternetReachable: null })).toBe(true);
  });

  it("is offline when not connected or the internet is not reachable", () => {
    expect(isOnlineState({ isConnected: false, isInternetReachable: true })).toBe(false);
    expect(isOnlineState({ isConnected: false, isInternetReachable: null })).toBe(false);
    expect(isOnlineState({ isConnected: true, isInternetReachable: false })).toBe(false);
  });
});
