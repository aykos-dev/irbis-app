import { AxiosHeaders, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';

import { axiosInstance, apiClient } from '../client';
import { ApiError } from '../errors';

function respondWith(status: number, data: unknown): { adapter: AxiosAdapter; seen: InternalAxiosRequestConfig[] } {
  const seen: InternalAxiosRequestConfig[] = [];
  const adapter: AxiosAdapter = async config => {
    seen.push(config);
    const response = { data, status, statusText: '', headers: {}, config };
    if (status >= 400) {
      const { AxiosError } = jest.requireActual<typeof import('axios')>('axios');
      throw new AxiosError('failed', 'ERR_BAD_RESPONSE', config, null, response);
    }
    return response;
  };
  return { adapter, seen };
}

describe('apiClient', () => {
  it('sends Accept-Language and no Idempotency-Key on GET', async () => {
    const { adapter, seen } = respondWith(200, { ok: true });
    axiosInstance.defaults.adapter = adapter;

    await expect(apiClient({ url: '/health', method: 'GET' })).resolves.toEqual({ ok: true });

    const headers = AxiosHeaders.from(seen[0]?.headers);
    expect(headers.get('Accept-Language')).toBe('en');
    expect(headers.has('Idempotency-Key')).toBe(false);
    expect(headers.has('Authorization')).toBe(false);
  });

  it('adds an Idempotency-Key to every non-GET request', async () => {
    const { adapter, seen } = respondWith(201, {});
    axiosInstance.defaults.adapter = adapter;

    await apiClient({ url: '/v1/things', method: 'POST', data: {} });

    expect(AxiosHeaders.from(seen[0]?.headers).get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('normalises failures to ApiError', async () => {
    const { adapter } = respondWith(404, { statusCode: 404, code: 'NOT_FOUND', message: 'nope' });
    axiosInstance.defaults.adapter = adapter;

    const failure = apiClient({ url: '/v1/missing', method: 'GET' });

    await expect(failure).rejects.toBeInstanceOf(ApiError);
    await expect(failure).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });
});
