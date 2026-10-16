import { focusManager } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';

/** Tells TanStack Query when the app is foregrounded, so stale queries refetch on return. */
export function wireFocusManager(): () => void {
  const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
    if (Platform.OS !== 'web') {
      focusManager.setFocused(status === 'active');
    }
  });
  return () => subscription.remove();
}

const statuses: readonly AppStateStatus[] = ['active', 'background', 'inactive', 'unknown', 'extension'];

function toStatus(value: string | null | undefined): AppStateStatus {
  return statuses.find(status => status === value) ?? 'unknown';
}

export function useAppState(): AppStateStatus {
  const [state, setState] = useState<AppStateStatus>(() => toStatus(AppState.currentState));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', setState);
    return () => subscription.remove();
  }, []);
  return state;
}
