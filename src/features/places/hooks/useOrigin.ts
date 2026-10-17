import { LocationManager, type GeolocationPosition } from '@maplibre/maplibre-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, PermissionsAndroid, Platform } from 'react-native';

import { qaLog } from '../../../shared/utils/qaLog';

export type Coords = { lat: number; lng: number };
type Permission = 'granted' | 'denied' | 'blocked';
export type OriginState =
  | { status: 'pending' }
  | { status: 'device'; coords: Coords }
  | { status: 'none'; permission: Permission };

/** One position fix may take this long before Explore falls back to Tashkent (AC6). */
export const FIX_TIMEOUT_MS = 10_000;

const ANDROID_LOCATION = [
  PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
];

/**
 * Android: core `PermissionsAndroid` (MapLibre's own request needs both fine and coarse and cannot
 * tell "denied" from "never ask again"). Approximate location is enough for distances.
 * iOS: MapLibre's when-in-use request; once refused iOS never asks again, so it counts as blocked.
 */
async function requestPermission(): Promise<Permission> {
  if (Platform.OS === 'android') {
    const results = Object.values(await PermissionsAndroid.requestMultiple(ANDROID_LOCATION));
    if (results.includes(PermissionsAndroid.RESULTS.GRANTED)) {
      return 'granted';
    }
    return results.every(result => result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN)
      ? 'blocked'
      : 'denied';
  }
  return (await LocationManager.requestPermissions()) ? 'granted' : 'blocked';
}

/** Re-check without a prompt (iOS only prompts while the status is undetermined). */
async function isGranted(): Promise<boolean> {
  if (Platform.OS === 'android') {
    return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION);
  }
  return LocationManager.requestPermissions();
}

function toCoords(position: GeolocationPosition): Coords {
  return { lat: position.coords.latitude, lng: position.coords.longitude };
}

/**
 * One fix: the last known position, else the first live update, within `FIX_TIMEOUT_MS`.
 * Resolves null when location is off or nothing arrives in time.
 */
function getFix(): Promise<Coords | null> {
  return new Promise(resolve => {
    let settled = false;
    const finish = (coords: Coords | null) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      LocationManager.removeListener(onUpdate);
      resolve(coords);
    };
    const onUpdate = (position: GeolocationPosition) => finish(toCoords(position));
    const timer = setTimeout(() => finish(null), FIX_TIMEOUT_MS);

    LocationManager.getCurrentPosition().then(
      position => {
        if (position) {
          finish(toCoords(position));
        } else if (!settled) {
          LocationManager.addListener(onUpdate);
        }
      },
      () => finish(null),
    );
  });
}

/**
 * Explore's distance origin (AC6): asks for location on first mount; granted → one fix and the
 * device origin; otherwise no coords (the API measures from Tashkent) and a banner to turn it on.
 * Returning to the app re-checks a missing permission.
 */
export function useOrigin() {
  const [state, setState] = useState<OriginState>({ status: 'pending' });
  const stateRef = useRef(state);
  stateRef.current = state;

  const resolveGranted = useCallback(async () => {
    const coords = await getFix();
    if (coords) {
      qaLog('location_permission', { result: 'granted' });
      setState({ status: 'device', coords });
    } else {
      qaLog('location_permission', { result: 'unavailable' });
      setState({ status: 'none', permission: 'granted' });
    }
  }, []);

  const ask = useCallback(async () => {
    const permission = await requestPermission();
    if (permission === 'granted') {
      await resolveGranted();
      return;
    }
    qaLog('location_permission', { result: permission });
    setState({ status: 'none', permission });
  }, [resolveGranted]);

  useEffect(() => {
    void ask();
  }, [ask]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', status => {
      const current = stateRef.current;
      if (status !== 'active' || current.status !== 'none') {
        return;
      }
      void (async () => {
        if (current.permission === 'granted' || (await isGranted())) {
          await resolveGranted();
        }
      })();
    });
    return () => subscription.remove();
  }, [resolveGranted]);

  /** "Turn on": ask again while the OS still can, otherwise open the app's settings. */
  const turnOn = useCallback(() => {
    const current = stateRef.current;
    if (current.status === 'none' && current.permission === 'denied') {
      void ask();
    } else {
      void Linking.openSettings();
    }
  }, [ask]);

  return {
    state,
    coords: state.status === 'device' ? state.coords : undefined,
    turnOn,
  };
}
