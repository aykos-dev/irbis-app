import { useGroupsList } from '../../../shared/api/generated/groups/groups';
import type { GroupSummaryDto } from '../../../shared/api/generated/model';
import { useAuth } from '../../../shared/contexts/auth';

/** Groups where I am an active owner or admin: the only groups a trip may link (AC1). */
export function useLeaderGroups() {
  const { status } = useAuth();
  const query = useGroupsList(undefined, { query: { enabled: status === 'signedIn' } });
  const groups: GroupSummaryDto[] = (query.data?.yours ?? []).filter(
    group =>
      group.viewerMembership?.status === 'active' &&
      (group.viewerMembership.role === 'owner' || group.viewerMembership.role === 'admin'),
  );
  return { groups, query };
}
