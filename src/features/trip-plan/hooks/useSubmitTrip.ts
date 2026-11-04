import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { errorMessageKey, isApiError } from '../../../shared/api/errors';
import type { TripDto, TripLocationDto } from '../../../shared/api/generated/model';
import {
  getGetCurrentTripsQueryKey,
  useCreateTrip,
  useStartTrip,
  useUpdateTrip,
} from '../../../shared/api/generated/trips/trips';
import { toast } from '../../../shared/components/toastBus';
import { t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { qaLog } from '../../../shared/utils/qaLog';
import { moveTicks } from '../gearTicks';
import { useStartLocation } from './useStartLocation';

/** API codes the plan screen branches on (trip-plan api briefs). */
const TRIP_ALREADY_ACTIVE = 'TRIP_ALREADY_ACTIVE';
const TRIP_TIMES_INVALID = 'TRIP_TIMES_INVALID';
const EMERGENCY_CONTACT_REQUIRED = 'EMERGENCY_CONTACT_REQUIRED';

const silent = { mutation: { meta: { silentError: true } } };

type Input = {
  placeId: string;
  startAt: string;
  backBy: string;
  alertEnabled: boolean;
  /** Edit mode (AC6): the saved trip being changed. */
  trip: TripDto | null;
  /** MMKV id the gear ticks were saved under until the trip had an id. */
  ticksId: string;
  /** `startedTripId` is set when the plan was started, so the screen can open the active trip. */
  onDone: (startedTripId?: string) => void;
};

/**
 * Save (`start: false`) or Start (`start: true`) a plan (AC6). New plans go through createTrip;
 * an edited plan is updated first and started with startTrip. Start sends the device location
 * when it is granted (AC6). Errors branch on `code`.
 */
export function useSubmitTrip() {
  const queryClient = useQueryClient();
  const locate = useStartLocation();
  const [locating, setLocating] = useState(false);
  const create = useCreateTrip(silent);
  const update = useUpdateTrip(silent);
  const startMutation = useStartTrip(silent);
  const [timesRejected, setTimesRejected] = useState(false);

  const persist = async (input: Input, start: boolean, location: TripLocationDto | undefined): Promise<TripDto> => {
    const { trip, placeId, startAt, backBy, alertEnabled } = input;
    if (!trip) {
      return create.mutateAsync({ data: { placeId, startAt, backBy, alertEnabled, start, location } });
    }
    const changes = trip.status === 'planned' ? { startAt, backBy, alertEnabled } : { backBy, alertEnabled };
    const updated = await update.mutateAsync({ id: trip.id, data: changes });
    if (start && updated.status === 'planned') {
      return startMutation.mutateAsync({ id: trip.id, data: { location } });
    }
    return updated;
  };

  const submit = async (input: Input, start: boolean): Promise<void> => {
    setTimesRejected(false);
    try {
      let location: TripLocationDto | undefined;
      if (start) {
        setLocating(true);
        location = await locate().finally(() => setLocating(false));
      }
      const saved = await persist(input, start, location);
      moveTicks(input.ticksId, saved.id);
      await queryClient.invalidateQueries({ queryKey: getGetCurrentTripsQueryKey() });
      if (start) {
        haptics.heavy();
        qaLog('trip_started', { tripId: saved.id, hasLocation: location !== undefined });
        toast.show({ variant: 'success', message: t('trip.started') });
      } else {
        haptics.success();
        qaLog('trip_saved', { tripId: saved.id });
        toast.show({ variant: 'success', message: t('trip.saved') });
      }
      input.onDone(start && saved.status === 'active' ? saved.id : undefined);
    } catch (error) {
      haptics.error();
      const code = isApiError(error) ? error.code : null;
      if (code === TRIP_TIMES_INVALID) {
        setTimesRejected(true);
      } else if (code === TRIP_ALREADY_ACTIVE) {
        toast.show({ variant: 'error', message: t('trip.alreadyActive') });
      } else if (code === EMERGENCY_CONTACT_REQUIRED) {
        toast.show({ variant: 'error', message: t('trip.contactRequired') });
      } else {
        toast.show({ variant: 'error', message: t(errorMessageKey(error)) });
      }
    }
  };

  return {
    submit,
    pending: locating || create.isPending || update.isPending || startMutation.isPending,
    timesRejected,
    clearTimesRejected: () => setTimesRejected(false),
  };
}
