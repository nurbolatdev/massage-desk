import type { NetInfoState } from "@react-native-community/netinfo";

// Unknown (null) counts as online, the same way TanStack Query treats it.
export function isOnlineState(state: Pick<NetInfoState, "isConnected" | "isInternetReachable">): boolean {
  return state.isConnected !== false && state.isInternetReachable !== false;
}
