import { usePreventRemove } from '@react-navigation/native';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';

import type { RootStackScreenProps } from '../../../app/navigation/types';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { Screen } from '../../../shared/components/Screen';
import { spacing } from '../../../shared/constants/spacing';
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
  PublicGame,
  RosterPlayer,
  Secret,
} from '../protocol/codec';
import { HOST_SEAT_ID } from '../room/roomReducer';
import { hostGame } from '../room/useHostRoom';
import { toPublic } from './gameReducer';
import { ImposterScreen } from './imposter/ImposterScreen';
import { findPack, localized, type PartyGame } from './packs';

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

const hostControls = {
  onReveal: () => hostGame.reveal(),
  onNewRound: () => hostGame.newRound(),
};

/**
 * The game route every phone opens on Start (AC2). Imposter renders its round (slice 2); the other
 * games show the dealt state until slice 3, and a mid-round joiner sees "Round in progress". The host ends
 * the game for everyone; the end (or `lobby` from the host) returns to the lobby.
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

  let view: GameView | null = null;
  if (hosted) {
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
    view = {
      game: player.game.game,
      packId: player.game.public.packId,
      dealt: player.seatId
        ? player.game.public.players.includes(player.seatId)
        : false,
      round: player.game.round,
      phase: player.game.phase,
      info: player.game.public,
      secret: player.deal?.secret ?? null,
      selfSeatId: player.seatId,
      roster: player.players,
    };
  }
  const active = view !== null;

  // Host: leaving the game screen ends the game, so Back asks first.
  usePreventRemove(!isPlayer && active, () => setConfirmEnd(true));

  useEffect(() => {
    if (!active && navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [active, navigation]);

  const endGame = () => {
    haptics.warning();
    setConfirmEnd(false);
    hostGame.end();
  };

  if (!view) {
    return null;
  }
  const pack = findPack(view.packId);
  return (
    <ThemeProvider scheme={campScheme}>
      <Screen testID="camp.game.waiting" scroll>
        {view.game === 'imposter' ? (
          <ImposterScreen
            round={view.round}
            phase={view.phase}
            info={view.info}
            secret={view.dealt ? imposterSecret(view.secret) : null}
            selfSeatId={view.selfSeatId}
            roster={view.roster}
            host={isPlayer ? undefined : hostControls}
          />
        ) : (
          <View style={layout.header}>
            <AppText variant="h1" accessibilityRole="header">
              {t(`camp.game.name.${view.game}`)}
            </AppText>
            {pack ? (
              <AppText variant="caption">{localized(pack.name)}</AppText>
            ) : null}
          </View>
        )}
        {view.dealt ? null : (
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
  header: { gap: spacing[6], alignItems: 'flex-start' },
  center: { textAlign: 'center' },
});
