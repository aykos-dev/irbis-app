import Geolocation from '@react-native-community/geolocation';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { errorMessageKey, isApiError } from '../../../shared/api/errors';
import type { CurrentTripsDto, TripDto, WaypointResultDto } from '../../../shared/api/generated/model';
import { getGetCurrentTripsQueryKey, useTripsCheckInWaypoint } from '../../../shared/api/generated/trips/trips';
import { useNetworkStatus } from '../../../shared/hooks/useNetworkStatus';
import { t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { qaLog } from '../../../shared/utils/qaLog';
import { addWaypointXp, MAX_ACCURACY_M } from '../trackStore';
import {
  loadQueue,
  localRejection,
  MAX_PER_TRIP,
  saveQueue,
  waypointCodes,
  type QueuedWaypoint,
  type WaypointRejection,
} from '../waypointQueue';

/** A fresh fix for the check-in (AC6): GPS accuracy, at most 10 s, never a cached position. */
export const CHECK_IN_FIX_OPTIONS = { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 } as const;

const silent = { mutation: { meta: { silentError: true } } };

export type XpFlash = { id: number; xp: number };

export type WaypointCheckIn = {
  /** Server waypoints plus queued ones. */
  count: number;
  max: number;
  allDone: boolean;
  busy: boolean;
  /** Translated feedback line, or null. */
  message: string | null;
  /** The last granted XP, to float the chip; a new id per grant. */
  xpFlash: XpFlash | null;
  checkIn: () => void;
};

function freshFix(): Promise<QueuedWaypoint | null> {
  return new Promise(resolve => {
    Geolocation.getCurrentPosition(
      position =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyM: position.coords.accuracy,
          recordedAt: new Date(position.timestamp).toISOString(),
        }),
      () => resolve(null),
      CHECK_IN_FIX_OPTIONS,
    );
  });
}

function rejectionText(rejection: WaypointRejection, max: number): string {
  const details = rejection.details ?? {};
  switch (rejection.code) {
    case waypointCodes.tooClose:
      return t('active.waypoint.tooClose', { m: details.remainingM ?? 0 });
    case waypointCodes.tooSoon:
      return t('active.waypoint.tooSoon', { min: details.remainingMin ?? 0 });
    case waypointCodes.inaccurate:
      return t('active.waypoint.inaccurate');
    case waypointCodes.limit:
      return t('active.waypoint.allDone', { max });
    default:
      return t('errors.generic');
  }
}

/**
 * Waypoint check-ins (AC6): a fresh fix goes to the server; XP and the pin appear only after its
 * answer. Offline (or when the request never arrives) the server's spacing rules run on the device
 * and the check-in waits in the per-trip queue, sent in order on reconnect.
 */
export function useWaypointCheckIn(trip: TripDto): WaypointCheckIn {
  const tripId = trip.id;
  const queryClient = useQueryClient();
  const { mutateAsync } = useTripsCheckInWaypoint(silent);
  const { isOnline } = useNetworkStatus();
  const [queue, setQueue] = useState(() => loadQueue(tripId));
  const [max, setMax] = useState(MAX_PER_TRIP);
  /** The server said the trip is full (WAYPOINT_LIMIT), whatever the device counts. */
  const [limitHit, setLimitHit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [xpFlash, setXpFlash] = useState<XpFlash | null>(null);
  const syncing = useRef(false);
  const flashId = useRef(0);
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const waypointsRef = useRef(trip.waypoints);
  waypointsRef.current = trip.waypoints;

  const count = trip.waypoints.length + queue.length;
  const allDone = limitHit || count >= max;

  const updateQueue = (items: QueuedWaypoint[]) => {
    queueRef.current = items;
    setQueue(items);
    saveQueue(tripId, items);
  };

  const reject = (rejection: WaypointRejection, error?: unknown) => {
    const limitMax = rejection.code === waypointCodes.limit ? (rejection.details?.max ?? MAX_PER_TRIP) : max;
    if (rejection.code === waypointCodes.limit) {
      setMax(limitMax);
      setLimitHit(true);
    }
    const known = Object.values<string>(waypointCodes).includes(rejection.code);
    setMessage(known || error === undefined ? rejectionText(rejection, limitMax) : t(errorMessageKey(error)));
    haptics.error();
    qaLog('waypoint_rejected', { tripId, code: rejection.code });
  };

  const accept = (result: WaypointResultDto, queued: boolean) => {
    addWaypointXp(tripId, result.xpAwarded);
    queryClient.setQueryData<CurrentTripsDto>(getGetCurrentTripsQueryKey(), current => {
      const active = current?.active;
      if (!current || active?.id !== tripId || active.waypoints.some(w => w.n === result.waypoint.n)) {
        return current;
      }
      return { ...current, active: { ...active, waypoints: [...active.waypoints, result.waypoint] } };
    });
    flashId.current += 1;
    setXpFlash({ id: flashId.current, xp: result.xpAwarded });
    setMessage(null);
    haptics.success();
    qaLog('waypoint_checked_in', { tripId, n: result.waypoint.n, xp: result.xpAwarded, queued });
  };

  const enqueue = (item: QueuedWaypoint) => {
    const rejection = localRejection([...waypointsRef.current, ...queueRef.current], item);
    if (rejection) {
      reject(rejection);
      return;
    }
    updateQueue([...queueRef.current, item]);
    setMessage(t('active.waypoint.queued'));
    haptics.success();
  };

  const checkIn = async () => {
    setBusy(true);
    try {
      const fix = await freshFix();
      if (!fix || fix.accuracyM > MAX_ACCURACY_M) {
        reject({ code: waypointCodes.inaccurate });
        return;
      }
      const item = { ...fix, accuracyM: Math.round(fix.accuracyM) };
      if (!isOnline) {
        enqueue(item);
        return;
      }
      try {
        accept(await mutateAsync({ id: tripId, data: item }), false);
      } catch (error) {
        if (isApiError(error) && error.status !== null) {
          reject({ code: error.code, details: error.details }, error);
        } else {
          enqueue(item);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const syncRef = useRef<() => Promise<void>>(() => Promise.resolve());
  syncRef.current = async () => {
    if (syncing.current) {
      return;
    }
    syncing.current = true;
    try {
      while (queueRef.current.length > 0) {
        const [item, ...rest] = queueRef.current;
        if (!item) {
          break;
        }
        try {
          const result = await mutateAsync({ id: tripId, data: item });
          updateQueue(rest);
          accept(result, true);
        } catch (error) {
          if (!isApiError(error) || error.status === null) {
            // Still unreachable: the rest waits for the next reconnect.
            break;
          }
          updateQueue(rest);
          reject({ code: error.code, details: error.details }, error);
        }
      }
    } finally {
      syncing.current = false;
    }
  };

  useEffect(() => {
    if (isOnline && queue.length > 0) {
      void syncRef.current();
    }
  }, [isOnline, queue.length]);

  return { count, max, allDone, busy, message, xpFlash, checkIn: () => void checkIn() };
}
