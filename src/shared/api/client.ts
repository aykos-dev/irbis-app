import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';

import { appConfig } from '../constants/config';
import { getLocale, t } from '../i18n';
import { uuidV4 } from '../utils/uuid';
import { ApiError, clientErrorCodes, normaliseError } from './errors';
import { tokenManager } from './tokenManager';

/**
 * The only axios instance — and the orval mutator. Components never call it directly; they use
 * generated hooks through feature hooks.
 */
const REQUEST_TIMEOUT_MS = 15_000;
const SAFE_METHODS = new Set(['get', 'head', 'options']);

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

export const axiosInstance = axios.create({
  baseURL: appConfig.apiUrl,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { Accept: 'application/json' },
});

axiosInstance.interceptors.request.use(async config => {
  const headers = AxiosHeaders.from(config.headers);
  headers.set('Accept-Language', getLocale());

  const method = (config.method ?? 'get').toLowerCase();
  if (!SAFE_METHODS.has(method) && !headers.has('Idempotency-Key')) {
    headers.set('Idempotency-Key', uuidV4());
  }

  const accessToken = await tokenManager.getAccessToken();
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  config.headers = headers;
  return config;
});

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  if (error instanceof AxiosError) {
    return normaliseError({
      status: error.response?.status ?? null,
      body: error.response?.data,
      isTimeout: error.code === AxiosError.ECONNABORTED || error.code === AxiosError.ETIMEDOUT,
      isNetwork: !error.response,
      fallbackMessage: t('errors.generic'),
    });
  }
  return new ApiError({
    code: clientErrorCodes.unknown,
    message: t('errors.generic'),
    status: null,
  });
}

axiosInstance.interceptors.response.use(
  response => response,
  async (error: unknown) => {
    if (error instanceof AxiosError && error.response?.status === 401 && error.config) {
      const original: RetriableConfig = error.config;
      if (!original._retried && (await tokenManager.hasSession())) {
        original._retried = true;
        const accessToken = await tokenManager.refresh();
        if (accessToken) {
          return axiosInstance.request(original);
        }
        await tokenManager.clear();
        throw new ApiError({
          code: clientErrorCodes.unauthorized,
          message: t('errors.unauthorized'),
          status: 401,
        });
      }
    }
    throw toApiError(error);
  },
);

/** orval mutator: `output.override.mutator` in orval.config.ts points here. */
export function apiClient<T>(config: AxiosRequestConfig, options?: AxiosRequestConfig): Promise<T> {
  return axiosInstance.request<T>({ ...config, ...options }).then(({ data }) => data);
}

export type ErrorType<_Error> = ApiError;
export type BodyType<Body> = Body;
