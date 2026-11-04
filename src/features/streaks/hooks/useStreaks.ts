import { useMeStreaks } from '../../../shared/api/generated';
import { staleTimes } from '../../../shared/api/query';
import { useAuth } from '../../../shared/contexts/auth';

/**
 * Flame + boot streaks for accounts (real and demo) only — guests never fetch (AC6). Refetches on
 * every app foreground; lesson sync and a sent check-in invalidate it. A failed refetch keeps the
 * last cached value (offline).
 */
export function useStreaks() {
  const { status } = useAuth();
  const signedIn = status === 'signedIn';
  const query = useMeStreaks({
    query: { enabled: signedIn, staleTime: staleTimes.list, refetchOnWindowFocus: 'always' },
  });
  return { ...query, signedIn };
}
