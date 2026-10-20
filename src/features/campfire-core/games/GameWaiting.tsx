import { usePreventRemove } from '@react-navigation/native';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
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
  CrocPhase,
  CrocPublic,
  CrocSecret,
  GamePhase,
  ImposterSecret,
  MafiaPublic,
  MafiaSecret,
  MafiaWinner,
  PublicGame,
  RosterPlayer,
  Secret,
  WhoamiSecret,
  WyrPick,
} from '../protocol/codec';
import { HOST_SEAT_ID } from '../room/roomReducer';
import { hostGame } from '../room/useHostRoom';
import { CrocScreen, type CrocHostControls } from './croc/CrocScreen';
import {
  crocSecretFor,
  toCrocPublic,
  toPublic,
  type MafiaState,
} from './gameReducer';
import { ImposterScreen } from './imposter/ImposterScreen';
import { GameOver } from './mafia/GameOver';
import { MafiaScreen, mafiaWinner } from './mafia/MafiaScreen';
import { WinSheet } from './mafia/WinSheet';
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
  onEnd: (winner: MafiaWinner) => hostGame.mafEnd(winner),
  onLobby: () => hostGame.end(),
  onPlayAgain: () => hostGame.mafPlayAgain(),
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
  /** Not dealt in; `info` once the game is over (every phone shows the result). */
  | { kind: 'waiting'; info: MafiaPublic };

/** Crocodile on this phone: the word card only when this seat is the describer. */
type CrocView = {
  phase: CrocPhase;
  info: CrocPublic;
  secret: CrocSecret | null;
  roster: RosterPlayer[];
};

const crocHostControls: CrocHostControls = {
  onNext: () => hostGame.crocNext(),
  onPlayAgain: () => hostGame.crocPlayAgain(),
  onLobby: () => hostGame.end(),
};

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
  // Turn time left is stamped once per host state change (like each broadcast), not on every render.
  const hostCroc = useMemo(
    () =>
      hosted?.game === 'croc' ? toCrocPublic(hosted, Date.now()) : null,
    [hosted],
  );

  let mafia: MafiaView | null = null;
  let view: GameView | null = null;
  let croc: CrocView | null = null;
  if (hosted?.game === 'mafia') {
    mafia = { kind: 'host', game: hosted };
  } else if (hosted?.game === 'croc') {
    croc = {
      phase: hosted.phase,
      info: hostCroc ?? toCrocPublic(hosted),
      secret: crocSecretFor(hosted, HOST_SEAT_ID),
      roster: hostRoster,
    };
  } else if (player?.game?.game === 'croc') {
    const { deal } = player;
    croc = {
      phase: player.game.phase,
      info: player.game.public,
      secret: deal?.game === 'croc' ? deal.secret : null,
      roster: player.players,
    };
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
        : { kind: 'waiting', info: player.game.public };
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
      secret:
        deal && deal.game !== 'mafia' && deal.game !== 'croc'
          ? deal.secret
          : null,
      selfSeatId: player.seatId,
      roster: player.players,
    };
  }
  const active = view !== null || mafia !== null || croc !== null;
  const mafiaHost = mafia?.kind === 'host' ? mafia.game : null;
  const mafiaOver = mafiaHost?.ended !== undefined;
  const crocOver = croc?.phase === 'ended';

  // Host: leaving the game screen ends the game, so Back asks first (after a game over: lobby).
  usePreventRemove(!isPlayer && active, () => {
    if (mafiaOver || crocOver) {
      hostGame.end();
      return;
    }
    setConfirmEnd(true);
  });

  useEffect(() => {
    if (!active && navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [active, navigation]);

  const vote = (pick: WyrPick) =>
    isPlayer ? client?.vote(pick) : hostGame.vote(pick);
  const showMine = () =>
    isPlayer ? client?.showMine() : hostGame.showMine();
  const crocSkip = () => (isPlayer ? client?.crocSkip() : hostGame.crocSkip());
  const crocStart = () =>
    isPlayer ? client?.crocStart() : hostGame.crocStart();
  const crocGuessed = () =>
    isPlayer ? client?.crocGuessed() : hostGame.crocGuessed();

  const endGame = (winner?: MafiaWinner) => {
    haptics.warning();
    setConfirmEnd(false);
    if (mafiaHost) {
      hostGame.mafEnd(winner ?? 'none');
      return;
    }
    if (croc) {
      hostGame.crocEnd();
      return;
    }
    hostGame.end();
  };
  // Mafia End game: a matching winner asks "<team> wins?", else "End without a winner?" (AC6).
  const endWinner = mafiaHost && confirmEnd ? mafiaWinner(mafiaHost) : null;

  if (!view && !mafia && !croc) {
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
        {mafia?.kind === 'waiting' && mafia.info.ended ? (
          <GameOver
            phase={mafia.info.phase}
            winner={mafia.info.ended.winner}
            roles={mafia.info.ended.roles}
            out={mafia.info.out}
            roster={player?.players ?? noRoster}
          />
        ) : null}
        {mafia?.kind === 'waiting' && !mafia.info.ended ? (
          <AppText variant="h1" accessibilityRole="header" style={layout.center}>
            {t('camp.games.mafia')}
          </AppText>
        ) : null}
        {mafia?.kind === 'waiting' && !mafia.info.ended ? (
          <AppText
            testID="camp.game.in-progress"
            variant="body"
            tone="muted"
            style={layout.center}
          >
            {t('camp.maf.inProgress')}
          </AppText>
        ) : null}
        {croc ? (
          <CrocScreen
            phase={croc.phase}
            info={croc.info}
            secret={croc.secret}
            roster={croc.roster}
            onPick={isPlayer ? undefined : hostGame.crocPick}
            onSkip={crocSkip}
            onStart={crocStart}
            onGuessed={crocGuessed}
            host={isPlayer ? undefined : crocHostControls}
          />
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
        {isPlayer || mafiaOver || crocOver ? null : (
          <AppButton
            testID={croc ? 'croc.end' : 'camp.game.end'}
            label={croc ? t('camp.croc.end') : t('camp.game.end')}
            variant="white"
            onPress={() => {
              haptics.tap();
              setConfirmEnd(true);
            }}
          />
        )}
        {confirmEnd && endWinner ? (
          <WinSheet
            winner={endWinner}
            onEnd={() => endGame(endWinner)}
            onKeepPlaying={() => setConfirmEnd(false)}
          />
        ) : null}
        {confirmEnd && !endWinner ? (
          <ConfirmSheet
            testID="camp.game.end-sheet"
            title={
              mafiaHost
                ? t('camp.maf.endNoWinner')
                : croc
                  ? t('camp.croc.endConfirm')
                  : t('camp.game.endConfirm')
            }
            confirmLabel={
              mafiaHost
                ? t('camp.maf.endGame')
                : croc
                  ? t('camp.croc.end')
                  : t('camp.game.end')
            }
            confirmTestID="camp.game.end-confirm"
            cancelTestID="camp.game.end-cancel"
            onConfirm={() => endGame()}
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
