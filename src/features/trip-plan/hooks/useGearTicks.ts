import { useCallback, useState } from 'react';

import type { GearKey } from '../../../shared/api/generated/model';
import { readTicks, writeTicks } from '../gearTicks';

/** Gear ticks for one draft or trip id, persisted in MMKV on every change (AC5). */
export function useGearTicks(id: string) {
  const [ticks, setTicks] = useState<GearKey[]>(() => readTicks(id));

  const toggle = useCallback(
    (key: GearKey, checked: boolean) => {
      setTicks(current => {
        const next = checked ? [...current.filter(k => k !== key), key] : current.filter(k => k !== key);
        writeTicks(id, next);
        return next;
      });
    },
    [id],
  );

  return { ticks, toggle };
}
