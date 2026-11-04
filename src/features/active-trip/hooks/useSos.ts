import { useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';

import { errorMessageKey, isApiError } from '../../../shared/api/errors';
import type { SosContactDto, TripDto } from '../../../shared/api/generated/model';
import { useTripsGetSosContact, useTripsSendSos } from '../../../shared/api/generated/trips/trips';
import { toast } from '../../../shared/components/toastBus';
import { useAuth } from '../../../shared/contexts/auth';
import { useLocale } from '../../../shared/hooks/useLocale';
import { useNetworkStatus } from '../../../shared/hooks/useNetworkStatus';
import { t } from '../../../shared/i18n';
import { storage } from '../../../shared/storage';
import { haptics } from '../../../shared/utils/haptics';
import { qaLog } from '../../../shared/utils/qaLog';
import type { Fix } from '../trackStore';
import { placeName } from '../tripFormat';

const KEY = 'active.sosContact';
const STATUS_TOO_MANY = 429;
const STATUS_BAD_GATEWAY = 502;
const COORD_DIGITS = 5;

const silent = { mutation: { meta: { silentError: true } } };

/** What the SOS sheet shows: sent by the server to {name}, or handed to the SMS app. */
export type SosOutcome = { via: 'server'; name: string; callNumber: string | null } | { via: 'sms_app'; callNumber: string | null };

function loadContact(tripId: string): SosContactDto | null {
  const raw = storage.getString(KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'tripId' in parsed &&
      parsed.tripId === tripId &&
      'phone' in parsed &&
      typeof parsed.phone === 'string' &&
      'sosCallNumber' in parsed
    ) {
      return { phone: parsed.phone, sosCallNumber: typeof parsed.sosCallNumber === 'string' ? parsed.sosCallNumber : null };
    }
    return null;
  } catch {
    return null;
  }
}

/** At check-out the SOS phone and rescue number leave the device. */
export function clearSosContact(): void {
  storage.remove(KEY);
}

/** `sms:` URL with the body; iOS separates the body with `&`, Android with `?`. */
export function smsUrl(phone: string, text: string): string {
  return `sms:${phone}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(text)}`;
}

/**
 * SOS (AC7): online the server texts the contact with the last fix; offline, on 502 or when the
 * request never arrives, the phone's SMS app opens with the same text. The contact's phone and the
 * rescue number are loaded when the screen opens and kept per trip — never logged.
 */
export function useSos(trip: TripDto, last: Fix | null) {
  const tripId = trip.id;
  const { isOnline } = useNetworkStatus();
  const { user } = useAuth();
  const locale = useLocale();
  const { mutateAsync, isPending } = useTripsSendSos(silent);
  const [contact, setContact] = useState(() => loadContact(tripId));
  const [outcome, setOutcome] = useState<SosOutcome | null>(null);
  const query = useTripsGetSosContact(tripId, { query: { enabled: isOnline, retry: false } });

  useEffect(() => {
    if (query.data) {
      storage.setString(KEY, JSON.stringify({ tripId, ...query.data }));
      setContact(query.data);
    }
  }, [query.data, tripId]);

  const openSmsApp = async () => {
    const lat = last?.lat ?? trip.place.latitude;
    const lng = last?.lng ?? trip.place.longitude;
    const text = t('active.sos.smsText', {
      name: user?.username ?? '',
      place: placeName(trip.place, locale),
      maps: `https://maps.google.com/?q=${lat.toFixed(COORD_DIGITS)},${lng.toFixed(COORD_DIGITS)}`,
      url: trip.liveUrl ?? '',
    });
    try {
      // Without a known phone the SMS app still opens with the text; the user picks the recipient.
      await Linking.openURL(smsUrl(contact?.phone ?? '', text));
      setOutcome({ via: 'sms_app', callNumber: contact?.sosCallNumber ?? null });
      qaLog('sos_sent', { tripId, via: 'sms_app' });
    } catch (error) {
      haptics.error();
      toast.show({ variant: 'error', message: t(errorMessageKey(error)) });
    }
  };

  const send = async () => {
    haptics.heavy();
    if (!isOnline) {
      await openSmsApp();
      return;
    }
    try {
      const data = last ? { lat: last.lat, lng: last.lng, accuracyM: Math.round(last.accuracyM) } : {};
      const result = await mutateAsync({ id: tripId, data });
      setOutcome({ via: 'server', name: result.contactName, callNumber: result.sosCallNumber ?? contact?.sosCallNumber ?? null });
      qaLog('sos_sent', { tripId, via: 'server' });
    } catch (error) {
      if (isApiError(error) && error.status === STATUS_TOO_MANY) {
        haptics.error();
        const sec = error.details?.retryInSec ?? error.retryAfterSec ?? 0;
        toast.show({ variant: 'error', message: t('active.sos.tooSoon', { sec }) });
        return;
      }
      if (!isApiError(error) || error.status === null || error.status === STATUS_BAD_GATEWAY) {
        await openSmsApp();
        return;
      }
      haptics.error();
      toast.show({ variant: 'error', message: t(errorMessageKey(error)) });
    }
  };

  return { send: () => void send(), sending: isPending, outcome, closeOutcome: () => setOutcome(null) };
}
