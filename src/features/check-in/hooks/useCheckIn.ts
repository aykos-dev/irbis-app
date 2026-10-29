import Geolocation from '@react-native-community/geolocation';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';

import { isApiError } from '../../../shared/api/errors';
import { useCheckInsCreate } from '../../../shared/api/generated/check-ins/check-ins';
import { getMeGetQueryKey } from '../../../shared/api/generated/me/me';
import { getMeLevelGetQueryKey } from '../../../shared/api/generated/levels/levels';
import type { CheckInResult, CreateCheckInDto, PlaceType } from '../../../shared/api/generated/model';
import { getPathGetQueryKey } from '../../../shared/api/generated/path/path';
import { getPlacesGetQueryOptions } from '../../../shared/api/generated/places/places';
import { useAuth } from '../../../shared/contexts/auth';
import { useLocale } from '../../../shared/hooks/useLocale';
import { useNetworkStatus } from '../../../shared/hooks/useNetworkStatus';
import { t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { qaLog } from '../../../shared/utils/qaLog';
import { uuidV4 } from '../../../shared/utils/uuid';
import { distanceParts, enqueue, haversineM, MAX_ACCURACY_M } from '../checkInQueue';

/** AC4: one fresh GPS fix, at most 10 s, never a cached position. */
export const CHECK_IN_FIX_OPTIONS = { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 } as const;

const CODE_TOO_FAR = 'CHECK_IN_TOO_FAR';
const CODE_INACCURATE = 'LOCATION_INACCURATE';
const SERVER_ERROR = 500;

/** What the button knows about the place; radius and elevation come from the place detail when missing. */
export type CheckInTarget = {
  placeId: string;
  name: string;
  type: PlaceType;
  /** The place's coordinates, for the local radius check. */
  lat: number;
  lng: number;
  elevationM?: number;
  checkInRadiusM?: number;
};

type Fix = { lat: number; lng: number; accuracyM: number; recordedAt: string };

export type CheckInState = {
  busy: boolean;
  /** Inline "too far" line, or null. */
  tooFar: string | null;
  /** Other inline feedback (inaccurate fix, rejected), or null. */
  message: string | null;
  permissionDenied: boolean;
  checkIn: () => void;
};

/** Android asks for fine location (accuracy ≤ 50 m); iOS uses the when-in-use prompt. */
async function requestWhenInUse(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, {
      title: t('checkin.button'),
      message: t('checkin.permission'),
      buttonPositive: t('checkin.allow'),
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

function freshFix(): Promise<Fix | null> {
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

/** After a sent check-in: XP, level and the monthly path changed on the server. */
export function invalidateAfterCheckIn(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: getMeGetQueryKey() });
  void queryClient.invalidateQueries({ queryKey: getMeLevelGetQueryKey() });
  void queryClient.invalidateQueries({ queryKey: getPathGetQueryKey() });
}

/** The place's radius and elevation: from the target, else the place detail (cached or fetched). */
async function placeFacts(
  queryClient: QueryClient,
  target: CheckInTarget,
): Promise<{ radiusM: number | null; elevationM: number | null }> {
  if (target.checkInRadiusM !== undefined) {
    return { radiusM: target.checkInRadiusM, elevationM: target.elevationM ?? null };
  }
  try {
    const detail = await queryClient.fetchQuery(getPlacesGetQueryOptions(target.placeId));
    return { radiusM: detail.checkInRadiusM, elevationM: detail.elevationM };
  } catch {
    // Unknown radius (offline, no cache): the server still verifies the distance on send.
    return { radiusM: null, elevationM: target.elevationM ?? null };
  }
}

/**
 * Check in (AC4, AC5): permission → one accurate fix → local radius check → send. Online success
 * opens Summit with the result; offline, network or 5xx stores it in the queue and opens Summit
 * queued. A 4xx answer is shown inline and nothing is stored. A guest's check-in is always queued
 * (AC6): the sync creates their demo account before sending it.
 */
export function useCheckIn(target: CheckInTarget): CheckInState {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const locale = useLocale();
  const { isOnline } = useNetworkStatus();
  const { status } = useAuth();
  const { mutateAsync } = useCheckInsCreate({ mutation: { meta: { silentError: true } } });
  const [busy, setBusy] = useState(false);
  const [tooFar, setTooFar] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const tooFarText = (distanceM: number, radiusM: number) => {
    const distance = distanceParts(distanceM, locale);
    const radius = distanceParts(radiusM, locale);
    return t('checkin.tooFar', { distance: t(distance.key, { n: distance.n }), radius: t(radius.key, { n: radius.n }) });
  };

  const summit = (elevationM: number | null, result: CheckInResult | null) => {
    navigation.navigate('Summit', {
      placeId: target.placeId,
      placeName: target.name,
      placeType: target.type,
      elevationM: elevationM ?? undefined,
      queued: result === null,
      counted: result?.counted ?? false,
      xp: result?.xp ?? 0,
    });
  };

  const queue = (item: CreateCheckInDto, elevationM: number | null) => {
    enqueue(item);
    qaLog('check_in_queued', { placeId: item.placeId });
    haptics.success();
    summit(elevationM, null);
  };

  const reject = (code: string) => {
    haptics.error();
    qaLog('check_in_rejected', { code });
  };

  const run = async () => {
    setTooFar(null);
    setMessage(null);
    if (!(await requestWhenInUse())) {
      setPermissionDenied(true);
      reject('PERMISSION_DENIED');
      return;
    }
    setPermissionDenied(false);
    const fix = await freshFix();
    if (!fix || fix.accuracyM > MAX_ACCURACY_M) {
      setMessage(t('checkin.inaccurate'));
      reject(CODE_INACCURATE);
      return;
    }
    const { radiusM, elevationM } = await placeFacts(queryClient, target);
    if (radiusM !== null) {
      const distanceM = haversineM(fix, { lat: target.lat, lng: target.lng });
      if (distanceM > radiusM) {
        setTooFar(tooFarText(distanceM, radiusM));
        reject(CODE_TOO_FAR);
        return;
      }
    }
    const item: CreateCheckInDto = {
      clientId: uuidV4(),
      placeId: target.placeId,
      ...fix,
      accuracyM: Math.round(fix.accuracyM),
    };
    if (!isOnline || status !== 'signedIn') {
      queue(item, elevationM);
      return;
    }
    try {
      const result = await mutateAsync({ data: item });
      haptics.success();
      qaLog('check_in_sent', { placeId: item.placeId, counted: result.counted, xp: result.xp, queued: false });
      summit(elevationM, result);
      invalidateAfterCheckIn(queryClient);
    } catch (error) {
      if (!isApiError(error) || error.status === null || error.status >= SERVER_ERROR) {
        queue(item, elevationM);
        return;
      }
      const details = error.details;
      if (error.code === CODE_TOO_FAR && details?.distanceM !== undefined && details.radiusM !== undefined) {
        setTooFar(tooFarText(details.distanceM, details.radiusM));
      } else {
        setMessage(t(error.code === CODE_INACCURATE ? 'checkin.inaccurate' : 'checkin.rejected'));
      }
      reject(error.code);
    }
  };

  const checkIn = () => {
    if (busy) {
      return;
    }
    haptics.tap();
    setBusy(true);
    void run().finally(() => setBusy(false));
  };

  return { busy, tooFar, message, permissionDenied, checkIn };
}
