import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { NativeModules, Platform } from 'react-native';

import {
  fakeDevice,
  fakeIosCampNet,
  fakeNet,
} from '../../../../jest/campNetFakes';
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
import { parseJoinUrl } from '../../../features/campfire-core/protocol/qr';
import { storage } from '../../../shared/storage';

/** The QR renders nothing here; the test reads the value it was given. */
const qr = { value: '' };
jest.mock('react-native-qrcode-svg', () => ({
  __esModule: true,
  default: (props: { value: string }) => {
    qr.value = props.value;
    return null;
  },
}));

let http: HttpStub;
const os = Platform.OS;

beforeEach(async () => {
  http = await setUpApp();
  fakeNet.reset();
  fakeIosCampNet.reset();
  storage.setString(
    'camp.profile',
    JSON.stringify({ nickname: 'guest_0', animal: 'fox' }),
  );
});
afterEach(async () => {
  Platform.OS = os;
  delete NativeModules.CampNet;
  await tearDownApp(http);
});

/** An iPhone: the iOS CampNet module (addresses only) is linked. */
function onIphone() {
  Platform.OS = 'ios';
  NativeModules.CampNet = fakeIosCampNet.module;
}

async function hostFromHub() {
  await renderApp();
  await openTab('community');
  await fireEvent.press(await screen.findByTestId('camp.hub.host'));
  await type('camp.player.nickname', 'guest_1');
  await fireEvent.press(screen.getByTestId('camp.player.continue'));
}

describe('campfire-core — iPhone host (AC4)', () => {
  it('AC4: Host on an iPhone opens the hotspot guide; "It\'s on" with no hotspot or Wi-Fi keeps it open', async () => {
    onIphone();
    await hostFromHub();

    const guide = await screen.findByTestId('camp.ios-guide');
    expect(guide).toHaveTextContent(/Turn on Personal Hotspot/);
    expect(guide).toHaveTextContent(/Open Settings → Personal Hotspot/);
    expect(guide).toHaveTextContent(/Switch on "Allow Others to Join"/);
    expect(guide).toHaveTextContent(/Come back to Irbis and tap "It's on"/);

    await fireEvent.press(screen.getByTestId('camp.ios-guide.done'));

    expect(await screen.findByTestId('camp.ios-guide.not-on')).toHaveTextContent(
      "We can't see the hotspot or Wi-Fi yet. Check it's on and try again.",
    );
    expect(screen.getByTestId('camp.ios-guide')).toBeOnTheScreen();
    expect(screen.queryByTestId('camp.lobby.screen')).not.toBeOnTheScreen();
    expect(fakeNet.servers).toHaveLength(0);
  });

  it('AC4: hotspot on → lobby on bridge100 with a room-only QR and "join in Settings first"', async () => {
    onIphone();
    await hostFromHub();
    await screen.findByTestId('camp.ios-guide');
    fakeIosCampNet.hotspot = { ip: '172.20.10.1', iface: 'bridge100' };
    fakeIosCampNet.wifi = { ip: '10.0.0.5', iface: 'en0' };

    await fireEvent.press(screen.getByTestId('camp.ios-guide.done'));

    expect(await screen.findByTestId('camp.lobby.chip')).toHaveTextContent(
      'Hotspot on',
    );
    const code = String(screen.getByTestId('camp.lobby.code').props.children);
    const joinUrl = qr.value;
    expect(joinUrl).not.toMatch(/ssid=|pw=/);
    expect(parseJoinUrl(joinUrl)).toEqual({
      code,
      ip: '172.20.10.1',
      port: 47821,
    });
    const lobby = screen.getByTestId('camp.lobby.screen');
    expect(screen.getByTestId('camp.lobby.qr-note')).toHaveTextContent(
      'Players join your Wi-Fi in Settings first',
    );
    expect(
      within(lobby).queryByText('Wi-Fi password in the QR'),
    ).not.toBeOnTheScreen();
    expect(fakeNet.server().port).toBe(47821);
    expect(qaEvents()).toContainEqual({
      event: 'camp_room_hosted',
      mode: 'hotspot',
    });
  });

  it('AC4: no hotspot but on Wi-Fi → lobby shows the Wi-Fi chip', async () => {
    onIphone();
    fakeIosCampNet.wifi = { ip: '10.0.0.5', iface: 'en0' };
    await hostFromHub();
    await fireEvent.press(await screen.findByTestId('camp.ios-guide.done'));

    expect(await screen.findByTestId('camp.lobby.chip')).toHaveTextContent(
      'Hosting on 10.0.0.5',
    );
    const joinUrl = qr.value;
    expect(parseJoinUrl(joinUrl)?.ip).toBe('10.0.0.5');
  });
});

describe('campfire-core — host battery warning (AC8)', () => {
  async function openHostLobby() {
    onIphone();
    fakeIosCampNet.wifi = { ip: '10.0.0.5', iface: 'en0' };
    await renderApp();
    await act(() => {
      navigationRef.navigate('CampLobby');
    });
    await screen.findByTestId('camp.lobby.chip');
  }

  function batteryEvents() {
    return qaEvents().filter(entry => entry.event === 'camp_battery_low');
  }

  it('AC8: 20 % unplugged shows the banner and logs camp_battery_low once; 21 % hides it', async () => {
    fakeDevice.set({ batteryLevel: 0.2, batteryState: 'unplugged' });
    await openHostLobby();

    expect(screen.getByTestId('camp.lobby.battery')).toHaveTextContent(
      "Battery 20% — plug in so the room doesn't stop",
    );
    expect(batteryEvents()).toEqual([{ event: 'camp_battery_low', pct: 20 }]);

    await act(() => fakeDevice.set({ batteryLevel: 0.21 }));
    expect(screen.queryByTestId('camp.lobby.battery')).not.toBeOnTheScreen();

    await act(() => fakeDevice.set({ batteryLevel: 0.19 }));
    expect(screen.getByTestId('camp.lobby.battery')).toHaveTextContent(
      /Battery 19%/,
    );
    expect(batteryEvents()).toHaveLength(1);
  });

  it('AC8: 21 % unplugged → no banner, no event', async () => {
    fakeDevice.set({ batteryLevel: 0.21, batteryState: 'unplugged' });
    await openHostLobby();

    expect(screen.queryByTestId('camp.lobby.battery')).not.toBeOnTheScreen();
    expect(batteryEvents()).toEqual([]);
  });

  it('AC8: 15 % while charging → no banner; unplugging shows it', async () => {
    fakeDevice.set({ batteryLevel: 0.15, batteryState: 'charging' });
    await openHostLobby();
    expect(screen.queryByTestId('camp.lobby.battery')).not.toBeOnTheScreen();

    await act(() => fakeDevice.set({ batteryState: 'unplugged' }));
    expect(screen.getByTestId('camp.lobby.battery')).toHaveTextContent(
      /Battery 15%/,
    );
  });
});
