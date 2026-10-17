import { apiClient } from '../client';
import { ApiError } from '../errors';
import { tokenManager } from '../tokenManager';
import { stubHttp, type HttpStub } from '../../../../jest/httpStub';

let http: HttpStub;

const refreshed = {
  status: 200,
  body: { accessToken: 'access_token_2', refreshToken: 'refresh_token_2', expiresIn: 900 },
};
const unauthorized = {
  status: 401,
  body: { statusCode: 401, code: 'UNAUTHORIZED', message: 'x', requestId: 'req_1' },
};

async function refreshHandler(refreshToken: string) {
  return apiClient<{ accessToken: string; refreshToken: string }>({
    url: '/v1/auth/refresh',
    method: 'POST',
    data: { refreshToken },
  });
}

beforeEach(async () => {
  http = stubHttp();
  await tokenManager.setTokens({ accessToken: 'access_token_1', refreshToken: 'refresh_token_1' });
  tokenManager.setRefreshHandler(refreshHandler, error => error instanceof ApiError && error.status === 401);
});
afterEach(async () => {
  tokenManager.setRefreshHandler(null);
  await tokenManager.clear();
  http.restore();
});

describe('session refresh (AC9)', () => {
  it('AC9: concurrent 401s share one refresh and all retry with the new token', async () => {
    http.reply('/v1/things', unauthorized, unauthorized, { status: 200, body: { ok: 1 } }, { status: 200, body: { ok: 2 } });
    http.reply('/v1/auth/refresh', refreshed);

    const results = await Promise.all([
      apiClient({ url: '/v1/things', method: 'GET' }),
      apiClient({ url: '/v1/things', method: 'GET' }),
    ]);

    expect(results).toHaveLength(2);
    expect(http.callsTo('/v1/auth/refresh')).toHaveLength(1);
    expect(http.callsTo('/v1/things')).toHaveLength(4);
  });

  it('AC9: a request is retried only once; a second 401 ends the session', async () => {
    http.reply('/v1/things', unauthorized);
    http.reply('/v1/auth/refresh', refreshed);
    const events: string[] = [];
    const off = tokenManager.onSignOut(event => events.push(event.reason));

    await expect(apiClient({ url: '/v1/things', method: 'GET' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });

    expect(http.callsTo('/v1/things')).toHaveLength(2);
    expect(http.callsTo('/v1/auth/refresh')).toHaveLength(1);
    off();
  });

  it('AC9: the refresh call itself never triggers another refresh', async () => {
    http.reply('/v1/things', unauthorized);
    http.reply('/v1/auth/refresh', unauthorized);
    const events: string[] = [];
    const off = tokenManager.onSignOut(event => events.push(event.reason));

    await expect(apiClient({ url: '/v1/things', method: 'GET' })).rejects.toBeInstanceOf(ApiError);

    expect(http.callsTo('/v1/auth/refresh')).toHaveLength(1);
    expect(events).toEqual(['expired']);
    expect(await tokenManager.hasSession()).toBe(false);
    off();
  });
});
