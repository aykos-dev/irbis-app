import { MutationCache, QueryClient } from '@tanstack/react-query';

import { toast } from '../components/toastBus';
import { t } from '../i18n';
import { ApiError, apiErrorCodes, clientErrorCodes, errorMessageKey } from './errors';

declare module '@tanstack/react-query' {
  interface Register {
    defaultError: ApiError;
    mutationMeta: {
      /** Set when the screen itself shows the failure (engineering-standards §10). */
      silentError?: boolean;
    };
  }
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;

/** Stale times per data shape (engineering-standards §6). Features pick one per query. */
export const staleTimes = {
  live: 0,
  list: 30 * SECOND,
  profile: 5 * MINUTE,
  reference: 30 * MINUTE,
} as const;

const MAX_RETRIES = 2;

function shouldRetry(failureCount: number, error: ApiError): boolean {
  if (error.status !== null && error.status >= 400 && error.status < 500) {
    return false;
  }
  return failureCount < MAX_RETRIES;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (mutation.meta?.silentError) {
          return;
        }
        // The session layer already tells the user (toast / blocked card) when a session ends.
        if (
          error.code === clientErrorCodes.unauthorized ||
          error.code === apiErrorCodes.accountBlocked
        ) {
          return;
        }
        toast.show({ variant: 'error', message: t(errorMessageKey(error)) });
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: staleTimes.list,
        retry: shouldRetry,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
