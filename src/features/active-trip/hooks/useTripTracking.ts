import Geolocation from '@react-native-community/geolocation';
import { useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';

import { useAppState } from '../../../shared/hooks/useAppState';
import { applyFix, loadTrack, saveTrack, type Fix, type Track } from '../trackStore';

export type LocationPermission = 'pending' | 'granted' | 'denied';

/** Watch options (AC2): a fix every 10 m of movement, GPS accuracy. */
export const WATCH_OPTIONS = { enableHighAccuracy: true, distanceFilter: 10 } as const;

/**
 * When-in-use location. Android asks once per screen visit and only checks afterwards, so a
 * return from the background never re-prompts; iOS answers from its stored choice.
 */
async function hasPermission(mayAsk: boolean): Promise<boolean> {
  if (Platform.OS === 'android') {
    const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
    if (await PermissionsAndroid.check(fine)) {
      return true;
    }
    return mayAsk && (await PermissionsAndroid.request(fine)) === PermissionsAndroid.RESULTS.GRANTED;
  }
  return new Promise(resolve => {
    Geolocation.requestAuthorization(
      () => resolve(true),
      () => resolve(false),
    );
  });
}

/**
 * Records the route of an active trip (AC2): watches the position only while the screen is mounted,
 * `enabled` and the app is in the foreground; every accepted fix updates distance and climb and is
 * saved per trip, so the track survives a restart.
 */
export function useTripTracking(tripId: string, enabled: boolean): { track: Track; permission: LocationPermission } {
  const foreground = useAppState() !== 'background';
  const [track, setTrack] = useState(() => loadTrack(tripId));
  const [permission, setPermission] = useState<LocationPermission>('pending');
  const asked = useRef(false);

  useEffect(() => {
    if (!enabled || !foreground) {
      return;
    }
    let live = true;
    const mayAsk = !asked.current;
    asked.current = true;
    hasPermission(mayAsk)
      .then(granted => live && setPermission(granted ? 'granted' : 'denied'))
      .catch(() => live && setPermission('denied'));
    return () => {
      live = false;
    };
  }, [enabled, foreground]);

  useEffect(() => {
    if (!enabled || !foreground || permission !== 'granted') {
      return;
    }
    const watchId = Geolocation.watchPosition(
      position => {
        const fix: Fix = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          alt: position.coords.altitude,
          accuracyM: position.coords.accuracy,
          at: position.timestamp,
        };
        setTrack(previous => applyFix(previous, fix));
      },
      error => {
        if (error.code === error.PERMISSION_DENIED) {
          setPermission('denied');
        }
      },
      WATCH_OPTIONS,
    );
    return () => Geolocation.clearWatch(watchId);
  }, [enabled, foreground, permission]);

  useEffect(() => {
    if (track.last) {
      saveTrack(track);
    }
  }, [track]);

  return { track, permission };
}
