/**
 * The one error shape every API failure is normalised to (ADR-003: the API answers
 * `{ statusCode, code, message, fieldErrors?, requestId }`). Components branch on `code`,
 * never on `message`.
 */
export type FieldErrors = Record<string, string[]>;

/** Client-side codes for failures that never reached the API's error filter. */
export const clientErrorCodes = {
  network: 'NETWORK_ERROR',
  timeout: 'TIMEOUT',
  unknown: 'UNKNOWN',
  unauthorized: 'UNAUTHORIZED',
} as const;

/** API error codes the client branches on (auth feature). */
export const apiErrorCodes = {
  accountBlocked: 'ACCOUNT_BLOCKED',
  accountLocked: 'ACCOUNT_LOCKED',
  invalidCredentials: 'INVALID_CREDENTIALS',
  rateLimited: 'RATE_LIMITED',
  refreshInvalid: 'REFRESH_INVALID',
  refreshReused: 'REFRESH_REUSED',
} as const;

export class ApiError extends Error {
  readonly code: string;
  readonly status: number | null;
  readonly fieldErrors?: FieldErrors;
  readonly requestId?: string;
  /** ACCOUNT_BLOCKED only: spam | harassment | unsafe | fake_content | other. */
  readonly reasonCode?: string;
  /** ACCOUNT_LOCKED, RATE_LIMITED: seconds until the client may retry. */
  readonly retryAfterSec?: number;
  /** Code-specific numbers (e.g. WAYPOINT_TOO_CLOSE remainingM, SOS_TOO_SOON retryInSec). */
  readonly details?: Record<string, number>;

  constructor(params: {
    code: string;
    message: string;
    status: number | null;
    fieldErrors?: FieldErrors;
    requestId?: string;
    reasonCode?: string;
    retryAfterSec?: number;
    details?: Record<string, number>;
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.code = params.code;
    this.status = params.status;
    this.fieldErrors = params.fieldErrors;
    this.requestId = params.requestId;
    this.reasonCode = params.reasonCode;
    this.retryAfterSec = params.retryAfterSec;
    this.details = params.details;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

type ErrorBody = {
  code?: unknown;
  message?: unknown;
  fieldErrors?: unknown;
  requestId?: unknown;
  reasonCode?: unknown;
  retryAfterSec?: unknown;
  details?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readFieldErrors(value: unknown): FieldErrors | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const result: FieldErrors = {};
  for (const [field, messages] of Object.entries(value)) {
    if (Array.isArray(messages)) {
      result[field] = messages.filter((m): m is string => typeof m === 'string');
    } else if (typeof messages === 'string') {
      result[field] = [messages];
    }
  }
  return result;
}

function readDetails(value: unknown): Record<string, number> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const result: Record<string, number> = {};
  for (const [key, number] of Object.entries(value)) {
    if (typeof number === 'number') {
      result[key] = number;
    }
  }
  return result;
}

/** Input is transport-agnostic so the normaliser is testable without axios. */
export type RawFailure = {
  status: number | null;
  body: unknown;
  isTimeout: boolean;
  isNetwork: boolean;
  fallbackMessage: string;
};

export function normaliseError(failure: RawFailure): ApiError {
  if (failure.isTimeout) {
    return new ApiError({
      code: clientErrorCodes.timeout,
      message: failure.fallbackMessage,
      status: null,
    });
  }
  if (failure.isNetwork || failure.status === null) {
    return new ApiError({
      code: clientErrorCodes.network,
      message: failure.fallbackMessage,
      status: null,
    });
  }
  const body: ErrorBody = isRecord(failure.body) ? failure.body : {};
  return new ApiError({
    code: typeof body.code === 'string' ? body.code : `HTTP_${failure.status}`,
    message: typeof body.message === 'string' ? body.message : failure.fallbackMessage,
    status: failure.status,
    fieldErrors: readFieldErrors(body.fieldErrors),
    requestId: typeof body.requestId === 'string' ? body.requestId : undefined,
    reasonCode: typeof body.reasonCode === 'string' ? body.reasonCode : undefined,
    retryAfterSec: typeof body.retryAfterSec === 'number' ? body.retryAfterSec : undefined,
    details: readDetails(body.details),
  });
}

/** i18n key for a user-facing message; never show `message` from the server raw. */
export function errorMessageKey(error: unknown): string {
  if (!isApiError(error)) {
    return 'errors.generic';
  }
  switch (error.code) {
    case clientErrorCodes.network:
      return 'errors.network';
    case clientErrorCodes.timeout:
      return 'errors.timeout';
    case clientErrorCodes.unauthorized:
      return 'errors.unauthorized';
    default:
      return 'errors.generic';
  }
}
