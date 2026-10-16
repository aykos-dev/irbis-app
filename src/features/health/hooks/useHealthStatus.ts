import { useEffect } from 'react';

import { ApiError } from '../../../shared/api/errors';
import { useHealthCheck } from '../../../shared/api/generated';
import { HealthCheckResponse } from '../../../shared/api/generated/zod/health/health.zod';
import { staleTimes } from '../../../shared/api/query';
import { qaLog } from '../../../shared/utils/qaLog';

export type HealthResult = ReturnType<typeof HealthCheckResponse.parse>;

/** `/health` answers 503 with the same body when the database is down (features/health.md). */
const acceptOkOrDegraded = (status: number) => status === 200 || status === 503;

export const INVALID_RESPONSE = 'INVALID_RESPONSE';

function parseHealth(body: unknown): HealthResult {
  const parsed = HealthCheckResponse.safeParse(body);
  if (!parsed.success) {
    throw new ApiError({ code: INVALID_RESPONSE, message: parsed.error.message, status: null });
  }
  return parsed.data;
}

/**
 * The Status screen's data: the generated `useHealthCheck`, with 200 and 503 both treated as a
 * result for this one request (validated against the generated zod schema). Logs
 * `health_checked { status, db }` each time a new result reaches the screen.
 */
export function useHealthStatus() {
  const query = useHealthCheck({
    request: { validateStatus: acceptOkOrDegraded },
    query: { select: parseHealth, staleTime: staleTimes.live },
  });

  const { data, dataUpdatedAt } = query;
  useEffect(() => {
    if (data) {
      qaLog('health_checked', { status: data.status, db: data.db });
    }
  }, [data, dataUpdatedAt]);

  return query;
}
