describe('qaLog', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
  });

  it('prints one IRBIS_QA JSON line in dev builds', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const { qaLog } = require('../qaLog') as typeof import('../qaLog');

    qaLog('health_checked', { status: 'ok', db: 'up' });

    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('IRBIS_QA {"event":"health_checked","status":"ok","db":"up"}');
  });

  it('is a no-op in production builds', () => {
    jest.doMock('react-native-config', () => ({
      __esModule: true,
      default: { API_URL: 'https://api.example.test', APP_ENV: 'prod' },
    }));
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const { qaLog } = require('../qaLog') as typeof import('../qaLog');

    qaLog('health_checked', { status: 'ok', db: 'up' });

    expect(log).not.toHaveBeenCalled();
  });
});
