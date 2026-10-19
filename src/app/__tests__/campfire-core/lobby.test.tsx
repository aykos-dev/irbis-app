import { act, fireEvent, screen, within } from '@testing-library/react-native';

import { fakeNet, type FakeSocket } from '../../../../jest/campNetFakes';
import {
  openTab,
  qaEvents,
  renderApp,
  setUpApp,
  tearDownApp,
  type,
  type HttpStub,
} from '../auth/harness';
import { navigationRef } from '../../navigation/navigationRef';
import { campNet } from '../../../features/campfire-core/native/campNet';
import { saveHostRoom } from '../../../features/campfire-core/room/hostRoomStore';
import {
  createRoom,
  roomReducer,
} from '../../../features/campfire-core/room/roomReducer';
import { storage } from '../../../shared/storage';

jest.mock('../../../features/campfire-core/native/campNet', () => ({
  campNet: {
    requestHotspotPermission: jest.fn(),
    startHotspot: jest.fn(),
    stopHotspot: jest.fn(),
    getWifiIp: jest.fn(),
    getWifiName: jest.fn(),
  },
}));

const net = jest.mocked(campNet);
const hotspot = { ssid: 'DIRECT-irbis', password: 'pw_1', ip: '192.168.49.1' };

let http: HttpStub;

beforeEach(async () => {
  http = await setUpApp();
  fakeNet.reset();
  net.requestHotspotPermission.mockReset().mockResolvedValue(true);
  net.startHotspot.mockReset().mockResolvedValue(hotspot);
  net.stopHotspot.mockReset().mockResolvedValue(undefined);
  net.getWifiIp.mockReset().mockResolvedValue(null);
  net.getWifiName.mockReset().mockResolvedValue(null);
  storage.setString(
    'camp.profile',
    JSON.stringify({ nickname: 'guest_0', animal: 'fox' }),
  );
});
afterEach(async () => {
  await tearDownApp(http);
});

async function openLobbyRoute() {
  await act(() => {
    navigationRef.navigate('CampLobby');
  });
}

async function openLobby() {
  await renderApp();
  await openLobbyRoute();
  await screen.findByTestId('camp.lobby.chip');
}

function code(): string {
  return String(screen.getByTestId('camp.lobby.code').props.children);
}

async function join(nickname: string, seatToken?: string): Promise<FakeSocket> {
  const client = fakeNet.server().connect();
  await act(() => {
    client.send({
      v: 2,
      type: 'hello',
      code: code(),
      nickname,
      avatar: 'bear',
      ...(seatToken ? { seatToken } : {}),
    });
  });
  return client;
}

describe('campfire-core — host on a hotspot or Wi-Fi (AC4)', () => {
  it('AC4: Host opens the lobby on a local hotspot with the QR card, code and room server', async () => {
    storage.remove('camp.profile');
    await renderApp();
    await openTab('community');
    await fireEvent.press(await screen.findByTestId('camp.hub.host'));
    await type('camp.player.nickname', 'guest_1');
    await fireEvent.press(screen.getByTestId('camp.player.continue'));

    expect(await screen.findByTestId('camp.lobby.chip')).toHaveTextContent(
      'Hotspot on',
    );
    const lobby = screen.getByTestId('camp.lobby.screen');
    expect(within(lobby).getByText("You're the host")).toBeOnTheScreen();
    expect(
      within(lobby).getByText('Scan to join Wi-Fi and room'),
    ).toBeOnTheScreen();
    expect(within(lobby).getByText('DIRECT-irbis')).toBeOnTheScreen();
    expect(
      within(lobby).getByText('Wi-Fi password in the QR'),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('camp.lobby.qr')).toBeOnTheScreen();
    expect(Number(code())).toBeGreaterThanOrEqual(1000);
    expect(Number(code())).toBeLessThanOrEqual(9999);

    expect(fakeNet.server().port).toBe(47821);
    expect(fakeNet.published).toEqual([
      {
        name: `irbis-${code()}`,
        type: 'irbiscamp',
        port: 47821,
        txt: { code: code() },
      },
    ]);
    expect(qaEvents()).toContainEqual({
      event: 'camp_room_hosted',
      mode: 'hotspot',
    });

    expect(screen.getByTestId('camp.lobby.count')).toHaveTextContent(
      'Players · 1 / 15',
    );
    expect(screen.getByTestId('camp.lobby.player.host')).toHaveTextContent(
      'guest_1 ★',
    );
    expect(screen.getByTestId('camp.lobby.empty')).toHaveTextContent(
      'Waiting for players…',
    );
    expect(screen.getByTestId('camp.lobby.start')).toBeDisabled();
    expect(
      within(lobby).getByText('Needs 3+ players'),
    ).toBeOnTheScreen();
  });

  it('AC4: hotspot failed → hosts on the Wi-Fi the phone is on, without Wi-Fi fields', async () => {
    net.startHotspot.mockRejectedValue(new Error('E_HOTSPOT'));
    net.getWifiIp.mockResolvedValue('10.0.0.5');
    net.getWifiName.mockResolvedValue('Camp');
    await openLobby();

    expect(screen.getByTestId('camp.lobby.chip')).toHaveTextContent(
      'Hosting on Camp',
    );
    expect(
      screen.queryByText('Wi-Fi password in the QR'),
    ).not.toBeOnTheScreen();
    expect(qaEvents()).toContainEqual({
      event: 'camp_room_hosted',
      mode: 'wifi',
    });
  });

  it('AC4: permission denied and no Wi-Fi → error with Try again; a retry with permission opens the room', async () => {
    net.requestHotspotPermission.mockResolvedValueOnce(false);
    await renderApp();
    await openLobbyRoute();

    const error = await screen.findByTestId('camp.lobby.error');
    expect(error).toHaveTextContent(/Couldn't start the hotspot/);
    expect(error).toHaveTextContent(
      /Allow nearby Wi-Fi devices to start the hotspot/,
    );
    expect(net.startHotspot).not.toHaveBeenCalled();
    expect(fakeNet.servers).toHaveLength(0);

    await fireEvent.press(screen.getByTestId('camp.lobby.retry'));
    expect(await screen.findByTestId('camp.lobby.chip')).toHaveTextContent(
      'Hotspot on',
    );
  });
});

describe('campfire-core — lobby seats (AC6, host)', () => {
  it('AC6: players join (duplicate name suffixed), ping is answered, a dropped player shows reconnecting', async () => {
    await openLobby();
    const first = await join('guest_1');
    const second = await join('guest_1');

    expect(first.received()[0]).toMatchObject({
      type: 'welcome',
      seatId: 'p1',
      room: { code: code() },
    });
    expect(screen.getByTestId('camp.lobby.count')).toHaveTextContent(
      'Players · 3 / 15',
    );
    expect(screen.getByTestId('camp.lobby.player.p2')).toHaveTextContent(
      /guest_1 2.*waiting/,
    );
    expect(screen.queryByTestId('camp.lobby.empty')).not.toBeOnTheScreen();
    expect(screen.getByText('All connected')).toBeOnTheScreen();
    expect(first.received().at(-1)).toMatchObject({
      type: 'roster',
      players: expect.arrayContaining([
        expect.objectContaining({ seatId: 'p2' }),
      ]),
    });
    expect(qaEvents()).toContainEqual({
      event: 'camp_player_joined',
      seats: 3,
      rejoin: false,
    });

    await act(() => second.send({ v: 2, type: 'ping' }));
    expect(second.received().at(-1)).toEqual({ v: 2, type: 'pong' });

    await act(() => second.drop());
    expect(screen.getByText('1 reconnecting')).toBeOnTheScreen();
    expect(screen.getByTestId('camp.lobby.player.p2')).toHaveTextContent(
      /reconnecting…/,
    );
  });

  it('AC6: long-press a player → "Remove <name>?" → removed, socket closed, seat freed', async () => {
    await openLobby();
    const client = await join('guest_2');

    await fireEvent(screen.getByTestId('camp.lobby.player.p1'), 'longPress');
    expect(
      await screen.findByTestId('camp.lobby.remove-sheet'),
    ).toHaveTextContent(/Remove guest_2\?/);
    await fireEvent.press(screen.getByTestId('camp.lobby.remove-confirm'));

    expect(client.received().at(-1)).toEqual({ v: 2, type: 'removed' });
    expect(client.destroyed).toBe(true);
    expect(screen.queryByTestId('camp.lobby.player.p1')).not.toBeOnTheScreen();
    expect(screen.getByTestId('camp.lobby.count')).toHaveTextContent(
      'Players · 1 / 15',
    );
    expect(qaEvents()).toContainEqual({
      event: 'camp_player_removed',
      seats: 1,
    });

    await fireEvent.press(screen.getByTestId('camp.lobby.game.mafia'));
    expect(await screen.findByTestId('app.toast')).toHaveTextContent(
      'Coming in the next update',
    );
  });
});

describe('campfire-core — save, resume and close (AC7, host)', () => {
  it('AC7: Back asks first; Close room tells everyone, stops everything and forgets the room', async () => {
    await renderApp();
    await openTab('community');
    await openLobbyRoute();
    await screen.findByTestId('camp.lobby.chip');
    const client = await join('guest_1');
    expect(
      JSON.parse(storage.getString('camp.hostRoom') ?? '{}').room.seats,
    ).toHaveLength(2);

    await act(() => {
      navigationRef.goBack();
    });
    expect(
      await screen.findByTestId('camp.lobby.close-sheet'),
    ).toHaveTextContent(/Close the room for everyone\?/);
    await fireEvent.press(screen.getByTestId('camp.lobby.close-cancel'));
    expect(navigationRef.getCurrentRoute()?.name).toBe('CampLobby');

    await fireEvent.press(screen.getByTestId('camp.lobby.close'));
    await fireEvent.press(
      await screen.findByTestId('camp.lobby.close-confirm'),
    );

    expect(client.received().at(-1)).toEqual({ v: 2, type: 'closed' });
    expect(client.destroyed).toBe(true);
    expect(fakeNet.server().closed).toBe(true);
    expect(fakeNet.unpublished).toContain(fakeNet.published[0]?.name);
    expect(net.stopHotspot).toHaveBeenCalled();
    expect(storage.getString('camp.hostRoom')).toBeUndefined();
    expect(qaEvents()).toContainEqual({ event: 'camp_room_closed', seats: 2 });
    await screen.findByTestId('camp.hub.screen');
    expect(screen.queryByTestId('camp.hub.resume')).not.toBeOnTheScreen();
  });

  it('AC7: Resume restores the saved seats as reconnecting; a known seat token takes its seat back', async () => {
    const hosted = createRoom('4821', { nickname: 'guest_0', avatar: 'fox' });
    const { state } = roomReducer(hosted, {
      type: 'hello',
      connId: 'old',
      hello: {
        v: 2,
        type: 'hello',
        code: '4821',
        nickname: 'guest_1',
        avatar: 'bear',
      },
      seatToken: 'seat_token_1',
    });
    saveHostRoom(state);

    await renderApp();
    await openTab('community');
    await fireEvent.press(await screen.findByTestId('camp.hub.resume'));
    expect(screen.queryByTestId('camp.hub.resume')).toBeNull();
    await screen.findByTestId('camp.lobby.chip');

    expect(code()).toBe('4821');
    expect(screen.getByText('1 reconnecting')).toBeOnTheScreen();
    expect(screen.getByTestId('camp.lobby.player.p1')).toHaveTextContent(
      /reconnecting…/,
    );
    expect(qaEvents()).toContainEqual({ event: 'camp_room_resumed', seats: 2 });

    const client = await join('guest_1', 'seat_token_1');
    expect(client.received()[0]).toMatchObject({
      type: 'welcome',
      seatId: 'p1',
      seatToken: 'seat_token_1',
    });
    expect(screen.getByText('All connected')).toBeOnTheScreen();
    expect(screen.getByTestId('camp.lobby.count')).toHaveTextContent(
      'Players · 2 / 15',
    );
    expect(qaEvents()).toContainEqual({
      event: 'camp_player_joined',
      seats: 2,
      rejoin: true,
    });
  });
});
