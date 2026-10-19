import { usePreventRemove } from '@react-navigation/native';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { StyleSheet } from 'react-native';

import type { RootStackScreenProps } from '../../../app/navigation/types';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { Screen } from '../../../shared/components/Screen';
import { ThemeProvider } from '../../../shared/contexts/theme';
import { useLocale } from '../../../shared/hooks/useLocale';
import { t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { campScheme } from '../campTheme';
import { ConfirmSheet } from '../components/ConfirmSheet';
import { playerSession } from '../join/playerClient';
import type {
  GamePhase,
  ImposterSecret,
  MafiaPublic,
  MafiaSecret,
  PublicGame,
  RosterPlayer,
  Secret,
  WhoamiSecret,
  WyrPick,
} from '../protocol/codec';
import { HOST_SEAT_ID } from '../room/roomReducer';
import { hostGame } from '../room/useHostRoom';
import { toPublic, type MafiaState } from './gameReducer';
import { ImposterScreen } from './imposter/ImposterScreen';
import { MafiaScreen } from './mafia/MafiaScreen';
import type { PartyGame } from './packs';
import { RatherScreen } from './rather/RatherScreen';
import { WhoAmIScreen } from './whoami/WhoAmIScreen';

type GameView = {
  game: PartyGame;
  packId: string;
  /** This phone's seat is dealt into the round (else it waits for the next one). */
  dealt: boolean;
  round: number;
  phase: GamePhase;
  info: PublicGame;
  secret: Secret | null;
  selfSeatId: string | null;
  roster: RosterPlayer[];
};

const noSubscribe = () => () => undefined;
const noSnapshot = () => null;
const noRoster: RosterPlayer[] = [];
const noRosterSnapshot = () => noRoster;

const imposterSecret = (secret: Secret | null): ImposterSecret | null =>
  secret && 'role' in secret ? secret : null;

const whoamiSecret = (secret: Secret | null): WhoamiSecret | null =>
  secret && 'others' in secret ? secret : null;

const hostControls = {
  onReveal: () => hostGame.reveal(),
  onNewRound: () => hostGame.newRound(),
};

const mafiaHostControls = {
  onPhaseNext: () => hostGame.mafPhaseNext(),
  onMarkOut: (seatId: string) => hostGame.mafMarkOut(seatId),
  onMarkBack: (seatId: string) => hostGame.mafMarkBack(seatId),
};

/** Mafia: the narrator's game, a player's dealt view, or a mid-game joiner who waits. */
type MafiaView =
  | { kind: 'host'; game: MafiaState }
  | {
      kind: 'player';
      round: number;
      info: MafiaPublic;
      secret: MafiaSecret;
      selfSeatId: string | null;
    }
  | { kind: 'waiting' };

const ratherHostControls = {
  onReveal: () => hostGame.revealVotes(),
  onNext: () => hostGame.nextQuestion(),
  onNewRound: () => hostGame.newRound(),
};

/**
 * The game route every phone opens on Start (AC2): the Imposter, Who am I, Would you rather or Mafia board;
 * a mid-round joiner sees "Round in progress". The host ends the game for everyone; the end (or
 * `lobby` from the host) returns to the lobby.
 */
export function GameWaiting({
  navigation,
  route,
}: RootStackScreenProps<'CampGame'>) {
  useLocale();
  const isPlayer = route.params?.player === true;
  const client = isPlayer ? playerSession.get() : null;
  const hosted = useSyncExternalStore(
    isPlayer ? noSubscribe : hostGame.subscribe,
    isPlayer ? noSnapshot : hostGame.getSnapshot,
  );
  const hostRoster = useSyncExternalStore(
    isPlayer ? noSubscribe : hostGame.subscribe,
    isPlayer ? noRosterSnapshot : hostGame.getRoster,
  );
  const player = useSyncExternalStore(
    client?.subscribe ?? noSubscribe,
    client?.getSnapshot ?? noSnapshot,
  );
  const [confirmEnd, setConfirmEnd] = useState(false);

  let mafia: MafiaView | null = null;
  let view: GameView | null = null;
  if (hosted?.game === 'mafia') {
    mafia = { kind: 'host', game: hosted };
  } else if (player?.game?.game === 'mafia') {
    const { deal } = player;
    mafia =
      deal?.game === 'mafia'
        ? {
            kind: 'player',
            round: player.game.round,
            info: player.game.public,
            secret: deal.secret,
            selfSeatId: player.seatId,
          }
        : { kind: 'waiting' };
  } else if (hosted) {
    view = {
      game: hosted.game,
      packId: hosted.settings.packId,
      dealt: hosted.players.includes(HOST_SEAT_ID),
      round: hosted.round,
      phase: hosted.phase,
      info: toPublic(hosted),
      secret: hosted.deals[HOST_SEAT_ID] ?? null,
      selfSeatId: HOST_SEAT_ID,
      roster: hostRoster,
    };
  } else if (player?.game) {
    const { deal } = player;
    view = {
      game: player.game.game,
      packId: player.game.public.packId,
      dealt: player.seatId
        ? player.game.public.players.includes(player.seatId)
        : false,
      round: player.game.round,
      phase: player.game.phase,
      info: player.game.public,
      secret: deal && deal.game !== 'mafia' ? deal.secret : null,
      selfSeatId: player.seatId,
      roster: player.players,
    };
  }
  const active = view !== null || mafia !== null;

  // Host: leaving the game screen ends the game, so Back asks first.
  usePreventRemove(!isPlayer && active, () => setConfirmEnd(true));

  useEffect(() => {
    if (!active && navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [active, navigation]);

  const vote = (pick: WyrPick) =>
    isPlayer ? client?.vote(pick) : hostGame.vote(pick);
  const showMine = () =>
    isPlayer ? client?.showMine() : hostGame.showMine();

  const endGame = () => {
    haptics.warning();
    setConfirmEnd(false);
    hostGame.end();
  };

  if (!view && !mafia) {
    return null;
  }
  return (
    <ThemeProvider scheme={campScheme}>
      <Screen testID="camp.game.waiting" scroll>
        {mafia?.kind === 'host' ? (
          <MafiaScreen
            kind="host"
            game={mafia.game}
            roster={hostRoster}
            controls={mafiaHostControls}
          />
        ) : null}
        {mafia?.kind === 'player' ? (
          <MafiaScreen
            kind="player"
            round={mafia.round}
            info={mafia.info}
            secret={mafia.secret}
            selfSeatId={mafia.selfSeatId}
            roster={player?.players ?? noRoster}
            onReady={() => client?.mafReady()}
          />
        ) : null}
        {mafia?.kind === 'waiting' ? (
          <AppText variant="h1" accessibilityRole="header" style={layout.center}>
            {t('camp.games.mafia')}
          </AppText>
        ) : null}
        {mafia?.kind === 'waiting' ? (
          <AppText
            testID="camp.game.in-progress"
            variant="body"
            tone="muted"
            style={layout.center}
          >
            {t('camp.maf.inProgress')}
          </AppText>
        ) : null}
        {view?.game === 'imposter' ? (
          <ImposterScreen
            round={view.round}
            phase={view.phase}
            info={view.info}
            secret={view.dealt ? imposterSecret(view.secret) : null}
            selfSeatId={view.selfSeatId}
            roster={view.roster}
            host={isPlayer ? undefined : hostControls}
          />
        ) : null}
        {view?.game === 'whoami' ? (
          <WhoAmIScreen
            info={view.info}
            secret={view.dealt ? whoamiSecret(view.secret) : null}
            selfSeatId={view.selfSeatId}
            roster={view.roster}
            onShowMine={showMine}
            host={isPlayer ? undefined : hostControls}
          />
        ) : null}
        {view?.game === 'rather' ? (
          <RatherScreen
            key={`${view.round}.${view.info.qIndex ?? 0}`}
            phase={view.phase}
            info={view.info}
            selfSeatId={view.selfSeatId}
            roster={view.roster}
            canVote={view.dealt}
            onVote={vote}
            host={isPlayer ? undefined : ratherHostControls}
          />
        ) : null}
        {!view || view.dealt ? null : (
          <AppText
            testID="camp.game.in-progress"
            variant="body"
            tone="muted"
            style={layout.center}
          >
            {t('camp.game.inProgress')}
          </AppText>
        )}
        {isPlayer ? null : (
          <AppButton
            testID="camp.game.end"
            label={t('camp.game.end')}
            variant="white"
            onPress={() => {
              haptics.tap();
              setConfirmEnd(true);
            }}
          />
        )}
        {confirmEnd ? (
          <ConfirmSheet
            testID="camp.game.end-sheet"
            title={t('camp.game.endConfirm')}
            confirmLabel={t('camp.game.end')}
            confirmTestID="camp.game.end-confirm"
            cancelTestID="camp.game.end-cancel"
            onConfirm={endGame}
            onDismiss={() => setConfirmEnd(false)}
          />
        ) : null}
      </Screen>
    </ThemeProvider>
  );
}

const layout = StyleSheet.create({
  center: { textAlign: 'center' },
});
