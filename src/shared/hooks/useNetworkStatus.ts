import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

/**
 * Network status from NetInfo. Unknown (`null`) counts as online so the first frame never
 * flashes the offline banner.
 */
export function isOnline(state: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>): boolean {
  return state.isConnected !== false && state.isInternetReachable !== false;
}

/** Feeds TanStack Query's onlineManager, so queries pause offline and refetch on reconnect. */
export function wireOnlineManager(): void {
  onlineManager.setEventListener(setOnline =>
    NetInfo.addEventListener(state => {
      setOnline(isOnline(state));
    }),
  );
}

function subscribe(onChange: () => void): () => void {
  return onlineManager.subscribe(onChange);
}

function getSnapshot(): boolean {
  return onlineManager.isOnline();
}

export function useNetworkStatus(): { isOnline: boolean } {
  const online = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { isOnline: online };
}
