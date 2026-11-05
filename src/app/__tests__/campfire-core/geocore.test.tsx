import { act, fireEvent, screen } from '@testing-library/react-native';

import { fakeNet } from '../../../../jest/campNetFakes';
import { navigationRef } from '../../navigation/navigationRef';
import { gameReducer, type GeoState } from '../../../features/campfire-core/games/gameReducer';
import { countries } from '../../../features/campfire-core/games/geocore/geoData';
import { campNet } from '../../../features/campfire-core/native/campNet';
import { saveHostRoom } from '../../../features/campfire-core/room/hostRoomStore';
import { createRoom, HOST_SEAT_ID } from '../../../features/campfire-core/room/roomReducer';
import { storage } from '../../../shared/storage';
import { openTab, qaEvents, renderApp, setUpApp, tearDownApp, type HttpStub } from '../auth/harness';

jest.mock('../../../features/campfire-core/native/campNet', () => ({
  campNet: {
    requestHotspotPermission: jest.fn(),
    startHotspot: jest.fn(),
    stopHotspot: jest.fn(),
    getWifiIp: jest.fn(),
    getWifiName: jest.fn(),
  },
}));

jest.setTimeout(20000);

const net = jest.mocked(campNet);

let http: HttpStub;

beforeEach(async () => {
  http = await setUpApp();
  jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] });
  fakeNet.reset();
  net.requestHotspotPermission.mockReset().mockResolvedValue(true);
  net.startHotspot
    .mockReset()
    .mockResolvedValue({ ssid: 'DIRECT-irbis', password: 'pw_1', ip: '192.168.49.1' });
  net.stopHotspot.mockReset().mockResolvedValue(undefined);
  net.getWifiIp.mockReset().mockResolvedValue(null);
  net.getWifiName.mockReset().mockResolvedValue(null);
  storage.setString('camp.profile', JSON.stringify({ nickname: 'guest_0', animal: 'fox' }));
});
afterEach(async () => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  await tearDownApp(http);
});

async function advance(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

function saved(): GeoState {
  const room: { game: GeoState } = JSON.parse(storage.getString('camp.hostRoom') ?? '{}');
  return room.game;
}

async function startSolo() {
  await renderApp();
  await act(() => {
    navigationRef.navigate('CampLobby', { game: 'geocore' });
  });
  await screen.findByTestId('camp.lobby.code');
  await fireEvent.press(screen.getByTestId('camp.lobby.start'));
  await screen.findByTestId('camp.game.waiting');
}

describe('campfire-geocore — hub and lobby (AC1, AC2)', () => {
  it('AC1: the Geocore tile opens the mode sheet; a mode goes through the player sheet to the lobby with it', async () => {
    await renderApp();
    await openTab('community');
    await fireEvent.press(await screen.findByTestId('camp.hub.game.geocore'));
    expect(await screen.findByTestId('geo.sheet')).toHaveTextContent(/City distance/);
    await fireEvent.press(screen.getByTestId('geo.sheet.cityDistance'));
    await fireEvent.press(await screen.findByTestId('camp.player.continue'));
    await screen.findByTestId('camp.lobby.code');
    expect(navigationRef.getCurrentRoute()?.params).toEqual({ game: 'geocore', geoMode: 'cityDistance' });
    expect(screen.getByTestId('camp.lobby.game.geocore')).toBeSelected();
    expect(screen.getByTestId('camp.lobby.geo.cityDistance')).toBeSelected();
    expect(screen.getByTestId('geo.settings')).toHaveTextContent(/Within 50 km \+1000 · 1,000 km 0 · far −1000/);
  });

  it('AC2: Find the country by default; Start works with only the host and starts that mode', async () => {
    await startSolo();
    expect(saved()).toMatchObject({ game: 'geo', mode: 'findCountry', phase: 'question', roundNo: 1, seats: [HOST_SEAT_ID] });
    expect(qaEvents()).toContainEqual({ event: 'camp_game_started', game: 'geo', mode: 'findCountry', players: 1 });
  });
});

describe('campfire-geocore — host timers (AC3, AC6)', () => {
  it("the host's timer closes the question at 20 s and starts the next round 8 s after the reveal", async () => {
    await startSolo();
    await advance(19900);
    expect(saved().phase).toBe('question');
    await advance(100);
    expect(saved()).toMatchObject({ phase: 'reveal', totals: { [HOST_SEAT_ID]: 0 } });
    expect(qaEvents()).toContainEqual({ event: 'geo_reveal', roundNo: 1, answered: 0, of: 1 });
    await advance(8000);
    expect(saved()).toMatchObject({ phase: 'question', roundNo: 2 });
    expect(qaEvents()).toContainEqual({ event: 'geo_round', mode: 'findCountry', roundNo: 2 });
  });

  it('a resumed room reschedules the question timer from the saved deadline', async () => {
    const promptIds = countries.slice(0, 10).map(country => country.id);
    const game = gameReducer(null, {
      type: 'startGeo',
      mode: 'countryToCapital',
      seats: [HOST_SEAT_ID],
      now: Date.now() - 15000,
      promptIds,
    });
    saveHostRoom(createRoom('4821', { nickname: 'guest_0', avatar: 'fox' }), Date.now(), game);
    await renderApp();
    await act(() => {
      navigationRef.navigate('CampLobby', { resume: true });
    });
    await screen.findByTestId('camp.game.waiting');
    expect(saved()).toMatchObject({ phase: 'question', mode: 'countryToCapital' });
    await advance(5000);
    expect(saved()).toMatchObject({ phase: 'reveal', roundNo: 1 });
  });
});
