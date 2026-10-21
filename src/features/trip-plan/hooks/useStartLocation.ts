import Geolocation from '@react-native-community/geolocation';
import { useCallback } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';

import type { TripLocationDto } from '../../../shared/api/generated/model';
import { t } from '../../../shared/i18n';

/** One fix may take this long before the trip starts without a location (AC6). */
export const START_FIX_TIMEOUT_MS = 10_000;

/** Android shows the rationale before the system prompt; iOS uses NSLocationWhenInUseUsageDescription. */
async function requestWhenInUse(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION, {
      title: t('trip.startCta'),
      message: t('trip.locationRationale'),
      buttonPositive: t('trip.card.start'),
    });
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }
  return new Promise(resolve => {
    Geolocation.requestAuthorization(
      () => resolve(true),
      () => resolve(false),
    );
  });
}

function currentPosition(): Promise<TripLocationDto | undefined> {
  return new Promise(resolve => {
    Geolocation.getCurrentPosition(
      position =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyM: Math.round(position.coords.accuracy),
        }),
      () => resolve(undefined),
      { timeout: START_FIX_TIMEOUT_MS, enableHighAccuracy: false },
    );
  });
}

/**
 * The device position at Start (AC6): asks for when-in-use location, then one low-accuracy fix.
 * Refused, timed out or failed → `undefined`, and the trip starts without it (no toast by spec).
 */
export function useStartLocation(): () => Promise<TripLocationDto | undefined> {
  return useCallback(async () => {
    try {
      return (await requestWhenInUse()) ? await currentPosition() : undefined;
    } catch {
      return undefined;
    }
  }, []);
}
