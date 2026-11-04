import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import type { CurrentTripsDto, TripDto } from '../../../shared/api/generated/model';
import { getGetCurrentTripsQueryKey, useTripsPostLocation } from '../../../shared/api/generated/trips/trips';
import { useAppState } from '../../../shared/hooks/useAppState';
import { useNetworkStatus } from '../../../shared/hooks/useNetworkStatus';
import { qaLog } from '../../../shared/utils/qaLog';
import type { Track } from '../trackStore';

const MINUTE_MS = 60_000;

const silent = { mutation: { meta: { silentError: true } } };

/**
 * Location pings (AC3): every `trip.pingEveryMin` minutes in the foreground the latest fix and the
 * running totals go to the server. A tick that falls offline (or fails) is sent once on reconnect,
 * with only the latest fix — never a backlog. A sent ping moves the trip's `lastLocationAt`.
 */
export function useTripPings(trip: TripDto | undefined, track: Track): void {
  const queryClient = useQueryClient();
  const { mutateAsync } = useTripsPostLocation(silent);
  const foreground = useAppState() !== 'background';
  const { isOnline } = useNetworkStatus();
  const trackRef = useRef(track);
  trackRef.current = track;
  const onlineRef = useRef(isOnline);
  onlineRef.current = isOnline;
  const owed = useRef(false);
  const tripId = trip?.id;
  const everyMin = trip?.pingEveryMin;

  const sendRef = useRef<(queued: boolean) => Promise<void>>(() => Promise.resolve());
  sendRef.current = async (queued: boolean) => {
    const fix = trackRef.current.last;
    if (!tripId || !fix) {
      return;
    }
    const { distanceM, climbM } = trackRef.current;
    try {
      await mutateAsync({
        id: tripId,
        data: {
          lat: fix.lat,
          lng: fix.lng,
          accuracyM: Math.round(fix.accuracyM),
          recordedAt: new Date(fix.at).toISOString(),
          distanceM: Math.round(distanceM),
          climbM: Math.round(climbM),
        },
      });
      qaLog('trip_ping_sent', { tripId, queued });
      const sentAt = new Date().toISOString();
      queryClient.setQueryData<CurrentTripsDto>(getGetCurrentTripsQueryKey(), current =>
        current?.active?.id === tripId ? { ...current, active: { ...current.active, lastLocationAt: sentAt } } : current,
      );
    } catch {
      // Not delivered: the next reconnect sends the latest fix instead (AC3, no backlog).
      owed.current = true;
    }
  };

  useEffect(() => {
    if (!tripId || !everyMin || !foreground) {
      return;
    }
    const timer = setInterval(() => {
      if (onlineRef.current) {
        void sendRef.current(false);
      } else {
        owed.current = true;
      }
    }, everyMin * MINUTE_MS);
    return () => clearInterval(timer);
  }, [tripId, everyMin, foreground]);

  useEffect(() => {
    if (isOnline && foreground && owed.current) {
      owed.current = false;
      void sendRef.current(true);
    }
  }, [isOnline, foreground]);
}
