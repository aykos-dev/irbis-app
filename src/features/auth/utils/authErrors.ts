import { apiErrorCodes, clientErrorCodes, isApiError } from '../../../shared/api/errors';
import { t } from '../../../shared/i18n';

/** Form fields a server error can land on (the form maps `password` to its own field name). */
export type AuthField = 'username' | 'password' | 'phone' | 'terms' | 'code';

export type MappedAuthError = {
  /** The field the message belongs under; absent = form-level message (`auth.error`). */
  field?: AuthField;
  message: string;
  code: string;
};

const SECONDS_PER_MINUTE = 60;

/** "15 minutes" — pluralised per locale (Russian one / few / many). */
export function lockMessage(retryAfterSec: number | undefined): string {
  const minutes = Math.max(1, Math.ceil((retryAfterSec ?? 0) / SECONDS_PER_MINUTE));
  return t('auth.errors.locked', { time: t('auth.minutes', { count: minutes }) });
}

const fieldByServerName: Record<string, AuthField> = {
  username: 'username',
  password: 'password',
  newPassword: 'password',
  recoveryPhone: 'phone',
  phone: 'phone',
  acceptTerms: 'terms',
  code: 'code',
};

/**
 * Turns an API failure into the message and the field it belongs to. Components branch on the
 * error code, never on the server's message (ADR-003); every message is translated.
 */
export function mapAuthError(error: unknown): MappedAuthError {
  if (!isApiError(error)) {
    return { message: t('errors.generic'), code: clientErrorCodes.unknown };
  }
  const { code } = error;
  switch (code) {
    case 'USERNAME_TAKEN':
      return { field: 'username', message: t('auth.errors.usernameTaken'), code };
    case 'USERNAME_RESERVED':
      return { field: 'username', message: t('auth.errors.usernameReserved'), code };
    case 'USERNAME_INVALID':
      return { field: 'username', message: t('auth.errors.usernameInvalid'), code };
    case 'PASSWORD_WEAK':
      return { field: 'password', message: t('auth.errors.passwordWeak'), code };
    case 'TERMS_REQUIRED':
      return { field: 'terms', message: t('auth.errors.termsRequired'), code };
    case 'PHONE_INVALID':
      return { field: 'phone', message: t('auth.errors.phoneInvalid'), code };
    case 'CODE_INVALID':
      return { field: 'code', message: t('auth.errors.codeInvalid'), code };
    case 'CODE_EXPIRED':
      return { field: 'code', message: t('auth.errors.codeExpired'), code };
    case 'CODE_ATTEMPTS':
      return { field: 'code', message: t('auth.errors.codeAttempts'), code };
    case apiErrorCodes.invalidCredentials:
      return { message: t('auth.errors.credentials'), code };
    case apiErrorCodes.accountLocked:
      return { message: lockMessage(error.retryAfterSec), code };
    case apiErrorCodes.rateLimited:
      return { message: t('auth.errors.rateLimited'), code };
    case clientErrorCodes.network:
      return { message: t('errors.network'), code };
    case clientErrorCodes.timeout:
      return { message: t('errors.timeout'), code };
    case 'VALIDATION_FAILED': {
      const first = Object.keys(error.fieldErrors ?? {})[0];
      const field = first ? fieldByServerName[first] : undefined;
      return { field, message: t('auth.errors.fieldInvalid'), code };
    }
    default:
      return { message: t('errors.generic'), code };
  }
}
