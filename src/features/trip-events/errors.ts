import { errorMessageKey, isApiError } from '../../shared/api/errors';

/** Group trip error codes with their own copy (spec API table). */
const knownCodes: ReadonlySet<string> = new Set([
  'TRIP_LEADER_REQUIRED',
  'GROUP_LINK_FORBIDDEN',
  'GROUP_TRIP_NOT_FOUND',
  'GROUP_TRIP_CLOSED',
  'GROUP_TRIP_FULL',
  'ALREADY_REQUESTED',
  'GROUP_TRIP_LOCKED',
  'LEADER_CANNOT_LEAVE',
  'NOT_ON_GROUP_TRIP',
  'SECURED_ACCOUNT_REQUIRED',
  'EMERGENCY_CONTACT_REQUIRED',
  'PLACE_NOT_FOUND',
  'GROUP_TRIP_INVALID',
]);

/** i18n key for a failed group trip call. */
export function tripErrorKey(error: unknown): string {
  if (isApiError(error) && knownCodes.has(error.code)) {
    return `tripEvents.errors.${error.code}`;
  }
  return errorMessageKey(error);
}

export function hasCode(error: unknown, code: string): boolean {
  return isApiError(error) && error.code === code;
}
