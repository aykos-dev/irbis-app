import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { errorMessageKey, isApiError } from '../../../shared/api/errors';
import type { TripDto } from '../../../shared/api/generated/model';
import {
  getGetCurrentTripsQueryKey,
  useCheckOutTrip,
  useDeleteTrip,
  useStartTrip,
  useUpdateTrip,
} from '../../../shared/api/generated/trips/trips';
import { toast } from '../../../shared/components/toastBus';
import { t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { qaLog } from '../../../shared/utils/qaLog';
import { useStartLocation } from './useStartLocation';

const TRIP_ALREADY_ACTIVE = 'TRIP_ALREADY_ACTIVE';
const TRIP_TIMES_INVALID = 'TRIP_TIMES_INVALID';

const silent = { mutation: { meta: { silentError: true } } };

/** One error toast per failed card action; the API code picks the copy when it has one. */
function showError(error: unknown) {
  haptics.error();
  const code = isApiError(error) ? error.code : null;
  let message = t(errorMessageKey(error));
  if (code === TRIP_ALREADY_ACTIVE) {
    message = t('trip.alreadyActive');
  } else if (code === TRIP_TIMES_INVALID) {
    message = t('trip.timesInvalid');
  }
  toast.show({ variant: 'error', message });
}

/**
 * Home trip card actions (AC7): check out, change back-by, start and delete a planned trip.
 * `onCheckedOut` lets the app layer clear what active-trip keeps on the device.
 */
export function useTripCardActions(onCheckedOut?: () => void) {
  const queryClient = useQueryClient();
  const checkOut = useCheckOutTrip(silent);
  const update = useUpdateTrip(silent);
  const start = useStartTrip(silent);
  const remove = useDeleteTrip(silent);
  const locate = useStartLocation();
  const [locating, setLocating] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: getGetCurrentTripsQueryKey() });

  const checkOutTrip = async (trip: TripDto) => {
    try {
      await checkOut.mutateAsync({ id: trip.id, data: {} });
      onCheckedOut?.();
      haptics.success();
      qaLog('trip_checked_out', { tripId: trip.id, late: Date.now() > Date.parse(trip.backBy), from: 'card' });
      toast.show({ variant: 'success', message: t('trip.welcomeBack') });
      await refresh();
    } catch (error) {
      showError(error);
    }
  };

  const changeBackBy = async (trip: TripDto, backBy: string): Promise<boolean> => {
    try {
      await update.mutateAsync({ id: trip.id, data: { backBy } });
      haptics.success();
      qaLog('trip_backby_changed', { tripId: trip.id });
      await refresh();
      return true;
    } catch (error) {
      showError(error);
      return false;
    }
  };

  /** True once the trip started, so the card can open the active trip. */
  const startTrip = async (trip: TripDto): Promise<boolean> => {
    try {
      setLocating(true);
      const location = await locate().finally(() => setLocating(false));
      await start.mutateAsync({ id: trip.id, data: { location } });
      haptics.heavy();
      qaLog('trip_started', { tripId: trip.id, hasLocation: location !== undefined });
      toast.show({ variant: 'success', message: t('trip.started') });
      await refresh();
      return true;
    } catch (error) {
      showError(error);
      return false;
    }
  };

  const deleteTrip = async (trip: TripDto) => {
    try {
      await remove.mutateAsync({ id: trip.id });
      haptics.success();
      qaLog('trip_deleted', { tripId: trip.id });
      await refresh();
    } catch (error) {
      showError(error);
    }
  };

  return {
    checkOutTrip,
    changeBackBy,
    startTrip,
    deleteTrip,
    pending: locating || checkOut.isPending || update.isPending || start.isPending || remove.isPending,
  };
}
