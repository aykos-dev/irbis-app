import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ThemeProvider } from '../../../../../shared/contexts/theme';
import { sounds } from '../../../../../shared/sounds/sounds';
import { campScheme, geoScreenColors } from '../../../campTheme';
import type { GeoPublic, RosterPlayer } from '../../../protocol/codec';
import { GeoScreen } from '../GeoScreen';
import { countryAt } from '../mapGeometry';

jest.mock('../../../../../shared/sounds/sounds', () => ({
  sounds: {
    load: jest.fn(() => Promise.resolve()),
    play: jest.fn(),
    muted: () => false,
    toggleMuted: jest.fn(() => true),
  },
}));

const played = jest.mocked(sounds.play);

const player = (seatId: string, nickname: string, host = false): RosterPlayer => ({
  seatId,
  nickname,
  avatar: 'fox',
  host,
  status: 'connected',
});
const roster = [
  player('host', 'guest_0', true),
  player('p1', 'guest_1'),
  player('p2', 'guest_2'),
  player('p3', 'guest_3'),
  player('p4', 'guest_4'),
];

const question = (over: Partial<GeoPublic> = {}): GeoPublic => ({
  mode: 'findCountry',
  roundNo: 4,
  of: 10,
  phase: 'question',
  promptId: 'ke',
  remainingMs: 12000,
  endsAt: 0,
  answered: ['p1'],
  totals: { host: 2710, p1: 3000, p2: 100 },
  reveal: null,
  ...over,
});

const hostControls = { onNext: jest.fn(), onPlayAgain: jest.fn(), onLobby: jest.fn() };

const wrap = (ui: ReactElement) => (
  <GestureHandlerRootView>
    <ThemeProvider scheme={campScheme}>{ui}</ThemeProvider>
  </GestureHandlerRootView>
);

async function show(info: GeoPublic, opts: { host?: boolean; onGuess?: jest.Mock } = {}) {
  await render(
    wrap(
      <GeoScreen
        info={info}
        selfSeatId="host"
        roster={roster}
        onGuess={opts.onGuess ?? jest.fn()}
        host={opts.host ? hostControls : undefined}
      />,
    ),
  );
}

/** Inside Kazakhstan, clear of every microstate dot at the start zoom. */
const inland = { lat: 48, lng: 67 };

/** A press on the map at `at` (MapLibre reports the touched point). */
const pressMap = async (at: { lat: number; lng: number }) =>
  act(async () => {
    fireEvent(screen.getByTestId('geo.globe.map'), 'press', {
      nativeEvent: { lngLat: [at.lng, at.lat], point: [0, 0] },
    });
  });

/** A press on Central Asia (in view at the start of a round). */
const tapCentre = () => pressMap(inland);

beforeEach(() => {
  played.mockClear();
  Object.values(hostControls).forEach(fn => fn.mockClear());
});

describe('GeoRound (AC3)', () => {
  it.each([
    ['findCountry', 'ke', 'Tap this country', 'Kenya'],
    ['capitalToCountry', 'ke', 'Which country has this capital?', 'Nairobi'],
    ['countryToCapital', 'ke', 'Pin the capital of', 'Kenya'],
    ['cityDistance', 'city-tashkent', 'Drop a pin on', 'Tashkent'],
  ] as const)('%s: prompt text from the promptId', async (mode, promptId, caption, big) => {
    await show(question({ mode, promptId }));
    expect(screen.getByTestId('geo.prompt')).toHaveTextContent(`${caption}${big}`);
  });

  it('header, timer from remainingMs and the answered count', async () => {
    await show(question());
    expect(screen.getByText('Find the country · Round 4 / 10')).toBeOnTheScreen();
    expect(screen.getByText('You 2,710 · 2 of 3')).toBeOnTheScreen();
    expect(screen.getByTestId('geo.timer')).toHaveTextContent('12');
    expect(screen.getByTestId('geo.timer')).toHaveProp('accessibilityLabel', '12 seconds left');
    expect(screen.getByTestId('geo.answered')).toHaveTextContent('1 of 3 locked in');
  });

  it('country mode: Lock in is disabled until a country is tapped; lock-in sends iso + point once, then waits', async () => {
    const onGuess = jest.fn();
    await show(question(), { onGuess });
    expect(screen.getByTestId('geo.lock')).toBeDisabled();
    expect(screen.getByTestId('geo.lock')).toHaveTextContent('Tap the globe first');
    await tapCentre();
    const iso = countryAt(inland);
    expect(iso).not.toBeNull();
    expect(screen.getByTestId('geo.lock')).toBeEnabled();
    await fireEvent.press(screen.getByTestId('geo.lock'));
    expect(onGuess).toHaveBeenCalledTimes(1);
    expect(onGuess).toHaveBeenCalledWith(
      expect.objectContaining({ iso, lat: expect.any(Number), lng: expect.any(Number) }),
    );
    expect(screen.queryByTestId('geo.lock')).toBeNull();
    expect(screen.getByTestId('geo.waiting')).toHaveTextContent('Locked in · waiting for others');
  });

  it('point mode: a pin enables Lock in pin', async () => {
    const onGuess = jest.fn();
    await show(question({ mode: 'cityDistance', promptId: 'city-tashkent' }), { onGuess });
    await tapCentre();
    expect(screen.getByTestId('geo.lock')).toHaveTextContent('Lock in pin');
    await fireEvent.press(screen.getByTestId('geo.lock'));
    expect(onGuess).toHaveBeenCalledWith({ lat: expect.any(Number), lng: expect.any(Number) });
  });
});

const reveal = (over: Partial<GeoPublic> = {}): GeoPublic =>
  question({
    mode: 'capitalToCountry',
    phase: 'reveal',
    remainingMs: 6000,
    answered: ['host', 'p1'],
    totals: { host: 3710, p1: 3000, p2: 4100 },
    reveal: {
      roundNo: 4,
      answer: { iso: 'KE', lat: 0.5, lng: 37.9 },
      results: [
        { seatId: 'host', iso: 'KE', lat: 0.5, lng: 37.9, km: 0, points: 1000 },
        { seatId: 'p1', iso: 'TZ', lat: -6, lng: 35, km: 412.4, points: 640 },
        { seatId: 'p2', km: null, points: 0 },
      ],
    },
    ...over,
  });

describe('GeoReveal (AC6)', () => {
  it('answer title, my result, standings sorted by total with my row; host gets Next', async () => {
    await show(reveal(), { host: true });
    expect(screen.getByText('Nairobi is in Kenya')).toBeOnTheScreen();
    expect(screen.getByTestId('geo.result')).toHaveTextContent('+1,000Spot on');
    const rows = screen.getAllByTestId(/^geo\.standings\./).map(row => row.props.testID);
    expect(rows).toEqual(['geo.standings.p2', 'geo.standings.host', 'geo.standings.p1']);
    expect(screen.getByTestId('geo.standings.host')).toHaveTextContent(/You.*Spot on.*\+1,000.*3,710/);
    expect(screen.getByTestId('geo.standings.p1')).toHaveTextContent(/guest_1.*412 km off.*\+640/);
    expect(screen.getByTestId('geo.standings.p2')).toHaveTextContent(/No answer/);
    expect(screen.getByText('Next round in 6 s')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('geo.next'));
    expect(hostControls.onNext).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('geo.waiting')).toBeNull();
  });

  it('a player without an answer sees No answer and waits for the host; See results after round 10', async () => {
    await render(
      wrap(
        <GeoScreen info={reveal()} selfSeatId="p2" roster={roster} onGuess={jest.fn()} />,
      ),
    );
    expect(screen.getByTestId('geo.result')).toHaveTextContent('No answer');
    expect(screen.getByTestId('geo.waiting')).toHaveTextContent('Waiting for the host');
    expect(screen.queryByTestId('geo.next')).toBeNull();
    await screen.rerender(
      wrap(
        <GeoScreen
          info={reveal({ roundNo: 10 })}
          selfSeatId="host"
          roster={roster}
          onGuess={jest.fn()}
          host={hostControls}
        />,
      ),
    );
    expect(screen.getByTestId('geo.next')).toHaveTextContent('See results');
  });

  it('plays correct from 900 points (500 in the pin games), else wrong', async () => {
    await show(reveal());
    await act(async () => undefined);
    expect(played).toHaveBeenLastCalledWith('correct', 'geo_');
    await screen.unmount();
    const city = reveal({
      mode: 'cityDistance',
      promptId: 'city-tashkent',
      reveal: {
        roundNo: 4,
        answer: { lat: 41.3, lng: 69.3 },
        results: [{ seatId: 'host', lat: 41, lng: 69, km: 260, points: 450 }],
      },
    });
    await show(city);
    await act(async () => undefined);
    expect(played).toHaveBeenLastCalledWith('wrong', 'geo_');
    expect(played).toHaveBeenCalledTimes(2);
  });
});

describe('Pin-game points (−1000 … +1000)', () => {
  it('own result and "this round": −350 in red, +650 in green, 0 plain', async () => {
    await show(
      reveal({
        mode: 'cityDistance',
        promptId: 'city-tashkent',
        totals: { host: -350, p1: 650, p2: 0 },
        reveal: {
          roundNo: 4,
          answer: { lat: 41.3, lng: 69.3 },
          results: [
            { seatId: 'host', lat: 50, lng: 80, km: 1300, points: -350 },
            { seatId: 'p1', lat: 41, lng: 70, km: 250, points: 650 },
            { seatId: 'p2', km: null, points: 0 },
          ],
        },
      }),
    );
    const mine = screen.getByTestId('geo.result.points');
    expect(mine).toHaveTextContent('\u2212350');
    expect(mine).toHaveStyle({ color: geoScreenColors.loss });
    expect(screen.getByTestId('geo.standings.p1')).toHaveTextContent(/\+650/);
    expect(screen.getByText('+650')).toHaveStyle({ color: geoScreenColors.gain });
    expect(screen.getByTestId('geo.standings.p2')).toHaveTextContent(/No answer0/);
    const rows = screen.getAllByTestId(/^geo\.standings\./).map(row => row.props.testID);
    expect(rows).toEqual(['geo.standings.p1', 'geo.standings.p2', 'geo.standings.host']);
  });
});

describe('Country games never name the tapped country', () => {
  it('after selecting Kenya in Find the country no "Kenya" is on screen and Lock in is generic', async () => {
    const onGuess = jest.fn();
    await show(question({ promptId: 'uz' }), { onGuess });
    // North Kenya: at the world zoom the Comoros dot's 22 pt reach covers the centroid.
    await pressMap({ lat: 3.5, lng: 35.5 });
    expect(screen.getByTestId('geo.lock')).toBeEnabled();
    expect(screen.getByTestId('geo.lock')).toHaveTextContent('Lock in');
    expect(screen.queryByText(/Kenya|Keniya/)).toBeNull();
    expect(screen.queryByTestId('geo.selected')).toBeNull();
    expect(screen.getByTestId('geo.globe').props.accessibilityValue.text).toBe('Country selected');
    await fireEvent.press(screen.getByTestId('geo.lock'));
    expect(onGuess).toHaveBeenCalledWith(expect.objectContaining({ iso: 'KE' }));
  });
});

const final = (totals: Record<string, number>): GeoPublic =>
  question({ phase: 'final', roundNo: 10, remainingMs: undefined, endsAt: undefined, totals });

describe('GeoFinal (AC7)', () => {
  it('a tie on 3rd shares step 3 and the next row is 5th; host Play again / Lobby; winner hears complete', async () => {
    await show(final({ host: 8420, p1: 7960, p2: 7105, p3: 7105, p4: 100 }), { host: true });
    expect(screen.getByText('You win!')).toBeOnTheScreen();
    expect(screen.getByText('Find the country · 10 rounds')).toBeOnTheScreen();
    expect(screen.getByTestId('geo.podium.3')).toHaveTextContent(/guest_2 · guest_3.*7,105 · tie/);
    expect(screen.getByTestId('geo.podium.1')).toHaveTextContent(/You.*8,420/);
    expect(screen.getByTestId('geo.final.p4')).toHaveTextContent(/^5/);
    await act(async () => undefined);
    expect(played).toHaveBeenCalledWith('complete', 'geo_');
    await fireEvent.press(screen.getByTestId('geo.play-again'));
    await fireEvent.press(screen.getByTestId('geo.lobby'));
    expect(hostControls.onPlayAgain).toHaveBeenCalledTimes(1);
    expect(hostControls.onLobby).toHaveBeenCalledTimes(1);
  });

  it('a tie for 1st shares the win (no step 2); players wait for the host', async () => {
    await render(
      wrap(
        <GeoScreen
          info={final({ host: 100, p1: 900, p2: 900 })}
          selfSeatId="host"
          roster={roster}
          onGuess={jest.fn()}
        />,
      ),
    );
    expect(screen.getByText('guest_1 · guest_2 share the win!')).toBeOnTheScreen();
    expect(screen.queryByTestId('geo.podium.2')).toBeNull();
    expect(screen.getByTestId('geo.podium.3')).toHaveTextContent(/You/);
    expect(screen.getByTestId('geo.waiting')).toHaveTextContent('Waiting for the host');
    expect(screen.queryByTestId('geo.play-again')).toBeNull();
    await act(async () => undefined);
    expect(played).not.toHaveBeenCalledWith('complete', 'geo_');
  });
});
