import { act, fireEvent, screen } from '@testing-library/react-native';

import { fakeNet, type FakeSocket } from '../../../../jest/campNetFakes';
import { navigationRef } from '../../navigation/navigationRef';
import { geoSizes } from '../../../features/campfire-core/campTheme';
import type { GeoState } from '../../../features/campfire-core/games/gameReducer';
import { campNet } from '../../../features/campfire-core/native/campNet';
import { HOST_SEAT_ID } from '../../../features/campfire-core/room/roomReducer';
import { storage } from '../../../shared/storage';
import { renderApp, setUpApp, tearDownApp, type HttpStub } from '../auth/harness';

jest.mock('../../../features/campfire-core/native/campNet', () => ({
  campNet: {
    requestHotspotPermission: jest.fn(),
    startHotspot: jest.fn(),
    stopHotspot: jest.fn(),
    getWifiIp: jest.fn(),
    getWifiName: jest.fn(),
  },
}));

/* The real map, with a count of how many times it mounts. */
jest.mock('../../../features/campfire-core/games/geocore/Globe', () => {
  const React = require('react');
  const actual = jest.requireActual('../../../features/campfire-core/games/geocore/Globe');
  const mounts = jest.fn();
  return {
    ...actual,
    __mounts: mounts,
    Globe: (props: object) => {
      React.useEffect(() => mounts(), []);
      return React.createElement(actual.Globe, props);
    },
  };
});

const globeMounts = jest.requireMock<{ __mounts: jest.Mock }>(
  '../../../features/campfire-core/games/geocore/Globe',
).__mounts;

jest.setTimeout(20000);

const net = jest.mocked(campNet);

let http: HttpStub;

beforeEach(async () => {
  http = await setUpApp();
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
  jest.restoreAllMocks();
  await tearDownApp(http);
});

function saved(): GeoState {
  const room: { game: GeoState } = JSON.parse(storage.getString('camp.hostRoom') ?? '{}');
  return room.game;
}

async function join(nickname: string): Promise<FakeSocket> {
  const code = String(screen.getByTestId('camp.lobby.code').props.children);
  const client = fakeNet.server().connect();
  await act(() => {
    client.send({ v: 6, type: 'hello', code, nickname, avatar: 'bear' });
  });
  return client;
}

async function openLobby() {
  await renderApp();
  await act(() => {
    navigationRef.navigate('CampLobby', { game: 'geocore' });
  });
  await screen.findByTestId('camp.lobby.code');
}

/** Presses the middle of the map (Central Asia at the start of a round) and locks the answer in. */
async function hostLocksIn() {
  await act(async () => {
    fireEvent(screen.getByTestId('geo.globe.map'), 'press', {
      nativeEvent: { lngLat: [geoSizes.initialLng, geoSizes.initialLat], point: [0, 0] },
    });
  });
  await fireEvent.press(screen.getByTestId('geo.lock'));
}

describe('campfire-geocore — the host plays on the round screen (AC3, AC6)', () => {
  it('the host sees the prompt, locks in from the globe and (solo) goes straight to the reveal with Next', async () => {
    globeMounts.mockClear();
    await openLobby();
    await fireEvent.press(screen.getByTestId('camp.lobby.start'));
    expect(await screen.findByTestId('geo.prompt')).toHaveTextContent(/Tap this country/);
    expect(screen.getByTestId('geo.answered')).toHaveTextContent('0 of 1 locked in');
    await hostLocksIn();
    expect(saved()).toMatchObject({ phase: 'reveal', roundNo: 1 });
    expect(await screen.findByTestId('geo.reveal')).toBeOnTheScreen();
    expect(screen.getByTestId(`geo.standings.${HOST_SEAT_ID}`)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('geo.next'));
    expect(saved()).toMatchObject({ phase: 'question', roundNo: 2 });
    expect(await screen.findByTestId('geo.prompt')).toBeOnTheScreen();
    expect(screen.getByTestId('geo.lock')).toHaveTextContent('Tap the globe first');
    // One MapLibre map for round 1 → reveal 1 → round 2 (no blank map while the timer runs).
    expect(globeMounts).toHaveBeenCalledTimes(1);
  });
});

describe('campfire-geocore — drop-out (AC8)', () => {
  it('everyone else answered and the last unanswered seat disconnects: the round closes early', async () => {
    await openLobby();
    const first = await join('guest_1');
    const second = await join('guest_2');
    await fireEvent.press(screen.getByTestId('camp.lobby.start'));
    await screen.findByTestId('geo.prompt');
    const { round } = saved();
    await act(() => first.send({ v: 6, type: 'geoGuess', round, roundNo: 1, lat: 41.3, lng: 69.3 }));
    await hostLocksIn();
    expect(saved().phase).toBe('question');
    expect(screen.getByTestId('geo.answered')).toHaveTextContent('2 of 3 locked in');

    await act(() => second.drop());
    expect(saved()).toMatchObject({ phase: 'reveal', roundNo: 1 });
    expect(await screen.findByTestId('geo.reveal')).toBeOnTheScreen();
    expect(screen.getByTestId('geo.standings.p2')).toHaveTextContent(/No answer/);
  });
});
