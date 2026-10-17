import { useAuthUsernameAvailable } from '../../../shared/api/generated/auth/auth';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import { t } from '../../../shared/i18n';
import { usernameSchema } from '../schemas';

const DEBOUNCE_MS = 400;

type Result = { status: 'pristine' | 'validating' | 'success' | 'error'; error?: string };

/**
 * Live availability while typing (AC3): pristine → validating → success | error. Only a username
 * that already passes the local rules is sent, and only once typing pauses. A failed check
 * (rate limit, offline) stays silent — the server decides at submit.
 */
export function useUsernameAvailability(username: string): Result {
  const typed = username.trim();
  const debounced = useDebounce(typed, DEBOUNCE_MS);
  const locallyValid = typed !== '' && usernameSchema.safeParse(typed).success;
  const settled = debounced === typed;

  const query = useAuthUsernameAvailable(
    { u: debounced },
    { query: { enabled: locallyValid && settled, retry: false } },
  );

  if (!locallyValid) {
    return { status: 'pristine' };
  }
  if (!settled || query.isFetching) {
    return { status: 'validating' };
  }
  const answer = query.data;
  if (answer?.available === true) {
    return { status: 'success' };
  }
  if (answer?.available === false) {
    return { status: 'error', error: reasonMessage(answer.reason) };
  }
  return { status: 'pristine' };
}

function reasonMessage(reason: string | undefined): string {
  switch (reason) {
    case 'taken':
      return t('auth.errors.usernameTaken');
    case 'reserved':
      return t('auth.errors.usernameReserved');
    default:
      return t('auth.errors.usernameInvalid');
  }
}
