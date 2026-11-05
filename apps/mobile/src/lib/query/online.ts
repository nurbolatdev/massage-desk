import NetInfo from "@react-native-community/netinfo";
import { focusManager, onlineManager } from "@tanstack/react-query";
import { AppState } from "react-native";
import { useSyncExternalStore } from "react";

import { isOnlineState } from "./onlineLogic";

// Returns a cleanup. Called from an effect, never at module load.
export function connectOnlineManager(): () => void {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      setOnline(isOnlineState(state));
    }),
  );
  return () => onlineManager.setEventListener(() => undefined);
}

export function connectFocusManager(): () => void {
  const subscription = AppState.addEventListener("change", (state) => {
    focusManager.setFocused(state === "active");
  });
  return () => subscription.remove();
}

export function useOnline(): boolean {
  return useSyncExternalStore(onlineManager.subscribe, onlineManager.isOnline);
}
