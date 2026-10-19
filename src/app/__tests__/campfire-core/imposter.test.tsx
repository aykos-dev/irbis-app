import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { fakeCamera, fakeNet, fakeWifi, type FakeSocket } from '../../../../jest/campNetFakes';
import { navigationRef } from '../../navigation/navigationRef';
import type { GameState } from '../../../features/campfire-core/games/gameReducer';
import { findPack } from '../../../features/campfire-core/games/packs';
import { campNet } from '../../../features/campfire-core/native/campNet';
import { secureScreen } from '../../../features/campfire-core/native/secureScreen';
import { buildJoinUrl } from '../../../features/campfire-core/protocol/qr';
import { createHostServer } from '../../../features/campfire-core/room/hostServer';
import { createRoom } from '../../../features/campfire-core/room/roomReducer';
import { storage } from '../../../shared/storage';
import {
  openTab,
  qaEvents,
  renderApp,
  setUpApp,
  tearDownApp,
  type HttpStub,
} from '../auth/harness';

jest.mock('../../../features/campfire-core/native/campNet', () => ({
  campNet: {
    requestHotspotPermission: jest.fn(),
    startHotspot: jest.fn(),
    stopHotspot: jest.fn(),
    getWifiIp: jest.fn(),
    getWifiName: jest.fn(),
  },
}));
jest.mock('../../../features/campfire-core/native/secureScreen', () => ({
  secureScreen: {
    setSecure: jest.fn(),
    isCaptured: jest.fn(),
    onCaptureChange: jest.fn(),
  },
}));

const net = jest.mocked(campNet);
const secure = jest.mocked(secureScreen);

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
  secure.setSecure.mockReset();
  secure.isCaptured.mockReset().mockResolvedValue(false);
  secure.onCaptureChange.mockReset().mockReturnValue(() => undefined);
  storage.setString('camp.profile', JSON.stringify({ nickname: 'guest_0', animal: 'fox' }));
});
afterEach(async () => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  await tearDownApp(http);
});

/** The word a pack item id shows in English. */
function wordText(wordId: string | undefined): string {
  const pack = findPack('imposter-animals');
  const item = pack && pack.game === 'imposter' ? pack.items.find(entry => entry.id === wordId) : undefined;
  return item?.en ?? '';
}

function savedWord(): string {
  const saved: { game?: { wordId?: string } } = JSON.parse(storage.getString('camp.hostRoom') ?? '{}');
  return wordText(saved.game?.wordId);
}

async function join(nickname: string): Promise<FakeSocket> {
  const code = String(screen.getByTestId('camp.lobby.code').props.children);
  const client = fakeNet.server().connect();
  await act(() => {
    client.send({ v: 2, type: 'hello', code, nickname, avatar: 'bear' });
  });
  return client;
}

/**
 * Host + 2 players, Imposter started. `random` pins Math.random for the deal: 0.99 = no shuffle
 * swaps (the host is the imposter, clue order = seat order); 0 = guest_1 is the imposter.
 */
async function startImposter(random: number, seesCategory = true) {
  await renderApp();
  await act(() => {
    navigationRef.navigate('CampLobby');
  });
  await screen.findByTestId('camp.lobby.code');
  const players = [await join('guest_1'), await join('guest_2')];
  if (!seesCategory) {
    await fireEvent(screen.getByTestId('camp.lobby.sees-category'), 'valueChange', false);
  }
  jest.spyOn(Math, 'random').mockReturnValue(random);
  await fireEvent.press(screen.getByTestId('camp.lobby.start'));
  await screen.findByTestId('imp.screen');
  return players;
}

const card = () => screen.getByTestId('camp.secret.card');

describe('campfire-party — hold to reveal, screen protection (AC3)', () => {
  it('AC3: the card is covered, shows the word while held and hides on release; FLAG_SECURE on focus, off on leave', async () => {
    await startImposter(0);
    const word = savedWord();

    expect(card()).toHaveTextContent('Hold to see');
    expect(screen.queryByText(word)).not.toBeOnTheScreen();
    expect(secure.setSecure).toHaveBeenLastCalledWith(true);

    await fireEvent(card(), 'pressIn');
    expect(screen.getByTestId('imp.word')).toHaveTextContent(word, { exact: false });
    expect(card()).toHaveTextContent(/Release to hide/);

    await fireEvent(card(), 'pressOut');
    expect(screen.queryByTestId('imp.word')).not.toBeOnTheScreen();
    expect(card()).toHaveTextContent('Hold to see');

    await fireEvent.press(screen.getByTestId('camp.game.end'));
    await fireEvent.press(await screen.findByTestId('camp.game.end-confirm'));
    await screen.findByTestId('camp.lobby.start');
    expect(secure.setSecure).toHaveBeenLastCalledWith(false);
  });

  it('AC3: while the screen is recorded (iOS) the card is a cover with the notice and never shows the secret', async () => {
    secure.isCaptured.mockResolvedValue(true);
    await startImposter(0);

    await waitFor(() => expect(card()).toHaveTextContent('Hidden while the screen is recorded'));
    await fireEvent(card(), 'pressIn');
    expect(screen.queryByTestId('imp.word')).not.toBeOnTheScreen();
  });
});

/** Host elements under a node: type, flattened style, own text and a11y label (what a viewer sees). */
type Node = ReturnType<typeof screen.getByTestId>;

function shape(node: Node): unknown[] {
  const self =
    typeof node.type === 'string'
      ? [
          {
            type: node.type,
            style: JSON.stringify(StyleSheet.flatten(node.props.style)),
            label: node.props.accessibilityLabel,
            text: node.children.filter(child => typeof child === 'string'),
          },
        ]
      : [];
  return [...self, ...node.children.flatMap(child => (typeof child === 'string' ? [] : shape(child)))];
}

describe('campfire-party — covered card is the same for every role (AC3)', () => {
  it('AC3: after release an imposter\'s card is identical to a word-holder\'s, no explainer or Got it left', async () => {
    await startImposter(0.99);
    const before = shape(card());
    await fireEvent(card(), 'pressIn');
    expect(screen.getByTestId('imp.imposter')).toBeOnTheScreen();
    await fireEvent(card(), 'pressOut');
    const imposterCovered = shape(card());
    expect(imposterCovered).toEqual(before);
    expect(screen.queryByText('How to win')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('imp.got-it')).not.toBeOnTheScreen();

    // rng 0 on the next round: guest_1 is the imposter, this phone holds the word.
    jest.spyOn(Math, 'random').mockReturnValue(0);
    await fireEvent.press(screen.getByTestId('imp.new-round'));
    await fireEvent(card(), 'pressIn');
    expect(screen.getByTestId('imp.word')).toBeOnTheScreen();
    await fireEvent(card(), 'pressOut');
    expect(shape(card())).toEqual(imposterCovered);
    expect(screen.queryByText('How to win')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('imp.got-it')).not.toBeOnTheScreen();
  });
});

describe('campfire-party — Imposter cards (AC4)', () => {
  it('AC4: header, round line, host chip, clue order with "You" and the hint', async () => {
    await startImposter(0.99);
    expect(screen.getByText('Round 1 · 3 players')).toBeOnTheScreen();
    expect(screen.getByText('Offline · host guest_0')).toBeOnTheScreen();
    expect(screen.getByText('Clue order · one word each')).toBeOnTheScreen();
    expect(screen.getByText('1. You')).toBeOnTheScreen();
    expect(screen.getByText('2. guest_1')).toBeOnTheScreen();
    expect(screen.getByText('3. guest_2')).toBeOnTheScreen();
    expect(
      screen.getByText("Give a clue that proves you know the word — but don't hand it to the imposter."),
    ).toBeOnTheScreen();
  });

  it('AC4: the word card shows YOUR SECRET WORD, the word and the pack as category', async () => {
    await startImposter(0);
    await fireEvent(card(), 'pressIn');
    const word = screen.getByTestId('imp.word');
    expect(word).toHaveTextContent(/YOUR SECRET WORD/);
    expect(word).toHaveTextContent(new RegExp(savedWord()));
    expect(word).toHaveTextContent(/Animals/);
    expect(screen.queryByTestId('imp.imposter')).not.toBeOnTheScreen();
  });

  it('AC4: the imposter card shows the category and, while held, how to win with Got it', async () => {
    await startImposter(0.99);
    await fireEvent(card(), 'pressIn');
    const imposter = screen.getByTestId('imp.imposter');
    expect(imposter).toHaveTextContent(/SHH…/);
    expect(imposter).toHaveTextContent(/You are the imposter/);
    expect(imposter).toHaveTextContent(/You don't know the word\. The category is:.*Animals/);
    expect(screen.queryByTestId('imp.word')).not.toBeOnTheScreen();
    expect(card()).toHaveTextContent(/How to win/);
    expect(card()).toHaveTextContent(/Not voted out\? You win\. Caught\? Guess the word to steal the win\./);

    await fireEvent.press(screen.getByTestId('imp.got-it'));
    await fireEvent(card(), 'pressOut');
    expect(screen.queryByTestId('imp.imposter')).not.toBeOnTheScreen();
    expect(screen.queryByText('How to win')).not.toBeOnTheScreen();
    expect(card()).toHaveTextContent('Hold to see');

    await fireEvent(card(), 'pressIn');
    expect(screen.getByTestId('imp.imposter')).toBeOnTheScreen();
    expect(screen.queryByTestId('imp.got-it')).not.toBeOnTheScreen();
  });

  it('AC4: with "Imposter sees the category" off the imposter only reads "You don\'t know the word."', async () => {
    await startImposter(0.99, false);
    await fireEvent(card(), 'pressIn');
    expect(screen.getByText("You don't know the word.")).toBeOnTheScreen();
    expect(screen.getByTestId('imp.imposter')).not.toHaveTextContent(/Animals/);
  });
});

describe('campfire-party — reveal and new round on the host (AC5)', () => {
  it('AC5: Reveal shows the imposter and the word on every phone; New round deals a new word, round 2', async () => {
    const [first] = await startImposter(0);
    const word = savedWord();

    await fireEvent.press(screen.getByTestId('imp.reveal'));
    const result = screen.getByTestId('imp.result');
    expect(result).toHaveTextContent(/The imposter was guest_1/);
    expect(result).toHaveTextContent(new RegExp(`The word was ${word}`));
    expect(screen.queryByTestId('imp.reveal')).not.toBeOnTheScreen();
    expect(qaEvents()).toContainEqual({ event: 'camp_imposter_revealed', imposters: 1 });
    expect(first?.received().at(-1)).toMatchObject({
      type: 'game',
      phase: 'revealed',
      public: { imposterSeatIds: ['p1'], wordId: expect.any(String) },
    });

    await fireEvent.press(screen.getByTestId('imp.new-round'));
    expect(screen.getByText('Round 2 · 3 players')).toBeOnTheScreen();
    expect(screen.queryByTestId('imp.result')).not.toBeOnTheScreen();
    expect(savedWord()).not.toBe(word);
    expect(first?.received().slice(-2).map(message => message.type)).toEqual(['deal', 'game']);
  });
});

describe('campfire-party — player phone (AC5)', () => {
  const HOST_IP = '192.168.49.1';
  const wifi = { ssid: 'DIRECT-irbis', password: 'pw_1' };

  beforeEach(() => {
    jest.useFakeTimers();
    fakeCamera.reset();
    fakeWifi.reset();
    net.getWifiIp.mockResolvedValue('192.168.49.23');
    storage.setString('camp.profile', JSON.stringify({ nickname: 'guest_1', animal: 'bear' }));
  });

  it('AC5: a player has no host buttons, reads "The host starts the next round" and sees the reveal', async () => {
    let game: GameState | null = null;
    const server = createHostServer({
      room: createRoom('4821', { nickname: 'guest_0', avatar: 'fox' }),
      network: wifi.ssid,
      onChange: (_room, next) => {
        game = next;
      },
    });
    await server.start();
    fakeNet.serve(HOST_IP, fakeNet.server());
    const other = fakeNet.server().connect();
    await act(() => other.send({ v: 2, type: 'hello', code: '4821', nickname: 'guest_2', avatar: 'eagle' }));

    await renderApp();
    await openTab('community');
    await act(() => {
      navigationRef.navigate('CampJoin');
    });
    await screen.findByTestId('camp.join.screen');
    await act(async () => {
      fakeCamera.scan(buildJoinUrl({ code: '4821', ip: HOST_IP, port: 47821, wifi }));
      await jest.advanceTimersByTimeAsync(10);
    });
    await fireEvent.press(await screen.findByTestId('camp.join.submit'));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10);
    });
    await screen.findByTestId('camp.lobby.wait');

    // rng 0: players [host, p1, p2] → guest_2 (p1) is the imposter, this phone (p2) has the word.
    await act(() =>
      server.startGame('imposter', { packId: 'imposter-animals', imposters: 1, showCategory: true }, () => 0),
    );
    await screen.findByTestId('imp.screen');
    expect(screen.queryByTestId('imp.reveal')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('imp.new-round')).not.toBeOnTheScreen();
    expect(screen.getByText('The host starts the next round')).toBeOnTheScreen();
    expect(screen.getByText('Offline · host guest_0')).toBeOnTheScreen();

    await act(() => server.reveal());
    const wordId = (game as GameState | null)?.wordId;
    expect(screen.getByTestId('imp.result')).toHaveTextContent(
      new RegExp(`The imposter was guest_2.*The word was ${wordText(wordId)}`),
    );
  });
});
