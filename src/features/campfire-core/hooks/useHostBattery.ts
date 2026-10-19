import { useEffect, useRef } from 'react';
import { useBatteryLevel, usePowerState } from 'react-native-device-info';

import { qaLog } from '../../../shared/utils/qaLog';

/** The host's phone runs the room: warn at 20 % and below while it isn't charging (AC8). */
const LOW_LEVEL = 0.2;
const PERCENT = 100;

/**
 * Host lobby battery (AC8): power state on mount (`usePowerState` reads it, then listens), level
 * updates from `useBatteryLevel`. Returns the rounded percent while low and unplugged, else null.
 * `camp_battery_low { pct }` fires once per room, the first time the warning shows.
 */
export function useHostBattery(roomCode: string | null): number | null {
  const power = usePowerState();
  const liveLevel = useBatteryLevel();
  const loggedFor = useRef<string | null>(null);

  const level = liveLevel ?? power.batteryLevel ?? null;
  const charging =
    power.batteryState === 'charging' || power.batteryState === 'full';
  const pct =
    level !== null && level >= 0 && level <= LOW_LEVEL && !charging
      ? Math.round(level * PERCENT)
      : null;

  useEffect(() => {
    if (pct === null || roomCode === null || loggedFor.current === roomCode) {
      return;
    }
    loggedFor.current = roomCode;
    qaLog('camp_battery_low', { pct });
  }, [pct, roomCode]);

  return pct;
}
