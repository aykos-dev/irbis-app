import { useCheckInSync } from '../features/check-in/hooks/useCheckInSync';

/** Session-level check-in wiring above the navigator: the offline queue sync (check-in AC5). */
export function CheckInSyncHost() {
  useCheckInSync();
  return null;
}
