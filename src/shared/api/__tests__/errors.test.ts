import { ApiError, clientErrorCodes, errorMessageKey, normaliseError } from '../errors';

const base = { isTimeout: false, isNetwork: false, fallbackMessage: 'fallback' };

describe('normaliseError', () => {
  it('keeps the API error body (ADR-003)', () => {
    const error = normaliseError({
      ...base,
      status: 422,
      body: {
        statusCode: 422,
        code: 'VALIDATION_FAILED',
        message: 'Invalid',
        fieldErrors: { username: ['taken'], password: 'too short' },
        requestId: 'req-1',
      },
    });

    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.status).toBe(422);
    expect(error.fieldErrors).toEqual({ username: ['taken'], password: ['too short'] });
    expect(error.requestId).toBe('req-1');
  });

  it('falls back to HTTP_<status> for a body without a code', () => {
    const error = normaliseError({ ...base, status: 502, body: '<html>' });
    expect(error.code).toBe('HTTP_502');
    expect(error.message).toBe('fallback');
  });

  it('maps no response to a network error and a timeout to TIMEOUT', () => {
    expect(normaliseError({ ...base, status: null, body: undefined, isNetwork: true }).code).toBe(
      clientErrorCodes.network,
    );
    expect(normaliseError({ ...base, status: null, body: undefined, isTimeout: true }).code).toBe(
      clientErrorCodes.timeout,
    );
  });

  it('maps codes to i18n keys, never to the raw message', () => {
    expect(errorMessageKey(new ApiError({ code: 'NETWORK_ERROR', message: 'x', status: null }))).toBe(
      'errors.network',
    );
    expect(errorMessageKey(new Error('boom'))).toBe('errors.generic');
  });
});
