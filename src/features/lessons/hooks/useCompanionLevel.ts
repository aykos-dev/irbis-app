import { useMeLevelGet } from '../../../shared/api/generated';
import { useAuth } from '../../../shared/contexts/auth';

/** The level whose companion cheers on the quiz: the account's level, level 1 (panda) for guests. */
export function useCompanionLevel(): number {
  const { status } = useAuth();
  const { data } = useMeLevelGet({ query: { enabled: status === 'signedIn' } });
  return status === 'signedIn' ? (data?.level ?? 1) : 1;
}
