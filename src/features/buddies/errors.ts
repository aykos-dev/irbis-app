import { errorMessageKey, isApiError } from '../../shared/api/errors';

/** Buddy error codes with their own copy (spec API table). */
const knownCodes: ReadonlySet<string> = new Set(['BUDDY_EXISTS', 'BUDDY_USER_NOT_FOUND', 'SECURED_ACCOUNT_REQUIRED']);

/** i18n key for a failed buddy call. */
export function buddyErrorKey(error: unknown): string {
  if (isApiError(error) && knownCodes.has(error.code)) {
    return `buddies.errors.${error.code}`;
  }
  return errorMessageKey(error);
}

export function hasCode(error: unknown, code: string): boolean {
  return isApiError(error) && error.code === code;
}
