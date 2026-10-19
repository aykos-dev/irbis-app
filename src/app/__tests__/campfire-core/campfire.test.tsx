import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import {
  goOffline,
  meBody,
  openTab,
  renderApp,
  setUpApp,
  startSignedIn,
  tearDownApp,
  type,
  type HttpStub,
} from '../auth/harness';
import { navigationRef } from '../../navigation/navigationRef';
import { storage } from '../../../shared/storage';
import { validNickname } from '../../../features/campfire-core/playerProfile';

let http: HttpStub;

beforeEach(async () => {
  http = await setUpApp();
});
afterEach(async () => {
  await tearDownApp(http);
});

async function openCommunity() {
  await renderApp();
  await openTab('community');
  await screen.findByTestId('camp.hub.screen');
}

async function openSheet(button: 'host' | 'join' = 'host') {
  await fireEvent.press(screen.getByTestId(`camp.hub.${button}`));
  await screen.findByTestId('camp.player.sheet');
}

describe('campfire-core — Community segments (AC1)', () => {
  it('AC1: opens on Campfire games; Feed and Groups show coming soon', async () => {
    await openCommunity();

    expect(screen.getByTestId('community.segment.campfire')).toBeSelected();
    expect(screen.getByTestId('community.segment.feed')).not.toBeSelected();

    await fireEvent.press(screen.getByTestId('community.segment.feed'));
    expect(screen.getByTestId('community.feed.coming-soon')).toHaveTextContent(/Coming with the next update/);
    expect(screen.queryByTestId('camp.hub.screen')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('community.segment.groups'));
    expect(screen.getByTestId('community.groups.coming-soon')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('community.segment.campfire'));
    expect(screen.getByTestId('camp.hub.screen')).toBeOnTheScreen();
  });
});

describe('campfire-core — CampHub (AC2)', () => {
  it('AC2: renders offline as a guest with no request; tagged items show the coming-soon toast', async () => {
    await goOffline();
    await openCommunity();

    const hub = screen.getByTestId('camp.hub.screen');
    expect(within(hub).getByText('Works offline')).toBeOnTheScreen();
    expect(within(hub).getByText('No internet. No problem.')).toBeOnTheScreen();
    expect(screen.getByTestId('camp.hub.game.mafia')).toHaveTextContent(/Mafia.*6–15 · 20–40 min/);
    expect(screen.getByTestId('camp.hub.game.mafia')).not.toHaveTextContent(/Coming soon/);
    expect(screen.getByTestId('camp.hub.badges')).toHaveTextContent(/Campfire badges.*Coming soon/);

    await fireEvent.press(screen.getByTestId('camp.hub.badges'));
    expect(await screen.findByTestId('app.toast')).toHaveTextContent('Coming in the next update');
    await fireEvent.press(screen.getByTestId('app.toast'));

    await fireEvent.press(screen.getByTestId('camp.hub.trip-group'));
    expect(await screen.findByTestId('app.toast')).toHaveTextContent('Coming in the next update');
    expect(http.calls).toHaveLength(0);
  });
});

describe('campfire-core — player sheet (AC3)', () => {
  it('AC3: nickname is trimmed and must be 2–16 characters', async () => {
    expect(validNickname('a')).toBeNull();
    expect(validNickname('  ab  ')).toBe('ab');
    expect(validNickname('a'.repeat(16))).toBe('a'.repeat(16));
    expect(validNickname('a'.repeat(17))).toBeNull();
    expect(validNickname('   a   ')).toBeNull();

    await openCommunity();
    await openSheet();
    expect(screen.getByTestId('camp.player.nickname')).toHaveDisplayValue('');
    expect(screen.getByTestId('camp.player.continue')).toBeDisabled();

    await type('camp.player.nickname', 'a');
    expect(screen.getByTestId('camp.player.nickname-error')).toHaveTextContent('2–16 characters');
    expect(screen.getByTestId('camp.player.continue')).toBeDisabled();

    await type('camp.player.nickname', 'a'.repeat(17));
    expect(screen.getByTestId('camp.player.continue')).toBeDisabled();

    await type('camp.player.nickname', 'a'.repeat(16));
    expect(screen.queryByTestId('camp.player.nickname-error')).not.toBeOnTheScreen();
    expect(screen.getByTestId('camp.player.continue')).toBeEnabled();
  });

  it('AC3: Continue saves the trimmed nickname and animal, then opens the lobby; the next open prefills them', async () => {
    await openCommunity();
    await openSheet('host');
    expect(screen.getByTestId('camp.player.avatar.fox')).toBeSelected();

    await type('camp.player.nickname', '  guest_1  ');
    await fireEvent.press(screen.getByTestId('camp.player.avatar.eagle'));
    expect(screen.getByTestId('camp.player.avatar.eagle')).toBeSelected();
    await fireEvent.press(screen.getByTestId('camp.player.continue'));

    expect(JSON.parse(storage.getString('camp.profile') ?? '')).toEqual({ nickname: 'guest_1', animal: 'eagle' });
    expect(navigationRef.getCurrentRoute()?.name).toBe('CampLobby');

    await act(() => {
      navigationRef.goBack();
    });
    await openSheet('join');
    expect(screen.getByTestId('camp.player.nickname')).toHaveDisplayValue('guest_1');
    expect(screen.getByTestId('camp.player.avatar.eagle')).toBeSelected();
    await fireEvent.press(screen.getByTestId('camp.player.continue'));
    expect(navigationRef.getCurrentRoute()?.name).toBe('CampJoin');
  });

  it('AC3: prefill order is saved nickname, then the signed-in username', async () => {
    http.reply('/v1/me', { status: 200, body: meBody({ username: 'guest_2' }) });
    await startSignedIn();
    await openCommunity();
    await waitFor(() => expect(http.callsTo('/v1/me')).toHaveLength(1));
    await act(async () => {
      await Promise.resolve();
    });
    await openSheet();
    expect(screen.getByTestId('camp.player.nickname')).toHaveDisplayValue('guest_2');
    // Swipe-down: the sheet's onDismiss unmounts it.
    await fireEvent(screen.getByTestId('camp.player.sheet'), 'dismiss');
    expect(screen.queryByTestId('camp.player.sheet')).not.toBeOnTheScreen();

    storage.setString('camp.profile', JSON.stringify({ nickname: 'guest_3', animal: 'bear' }));
    await openSheet();
    expect(screen.getByTestId('camp.player.nickname')).toHaveDisplayValue('guest_3');
    expect(screen.getByTestId('camp.player.avatar.bear')).toBeSelected();
  });
});
