import {
  usePreventRemove,
  type NavigationAction,
} from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { RootStackScreenProps } from '../../../app/navigation/types';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { EmptyState } from '../../../shared/components/EmptyState';
import { Pressable } from '../../../shared/components/Pressable';
import { Screen } from '../../../shared/components/Screen';
import { Sheet } from '../../../shared/components/Sheet';
import { Skeleton } from '../../../shared/components/Skeleton';
import { StatusChip } from '../../../shared/components/StatusChip';
import { useToast } from '../../../shared/components/Toast';
import { palette } from '../../../shared/constants/colors';
import {
  borders,
  radii,
  sizes,
  spacing,
} from '../../../shared/constants/spacing';
import {
  createThemedStyles,
  ThemeProvider,
} from '../../../shared/contexts/theme';
import { useLocale } from '../../../shared/hooks/useLocale';
import { t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { campScheme, lobbySizes, type GameId } from '../campTheme';
import { ComingSoonTag } from '../components/ComingSoonTag';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { RoomQr } from '../components/RoomQr';
import type { RosterPlayer } from '../protocol/codec';
import { reconnectingCount, toRoster } from '../room/roomReducer';
import { useHostRoom, type HostNetwork } from '../room/useHostRoom';

const lobbyGames: GameId[] = ['imposter', 'mafia', 'whoami', 'rather'];
const SELECTED_GAME: GameId = 'imposter';
/** Start stays disabled until games ship (`lobby.startSoon`). */
const noop = () => undefined;

function gameLabel(game: GameId): string {
  return game === 'rather'
    ? t('camp.lobby.gameRather')
    : t(`camp.games.${game}`);
}

function chipLabel(network: HostNetwork): string {
  return network.mode === 'hotspot'
    ? t('camp.lobby.hotspotOn')
    : t('camp.lobby.wifiChip', { name: network.name });
}

/**
 * Host lobby (AC4, AC6, AC7 host side): hotspot or Wi-Fi, room server, QR and code, seats with
 * remove, game pills (coming soon), close with confirm. Back asks before closing the room.
 */
export function CampLobbyScreen({
  navigation,
  route,
}: RootStackScreenProps<'CampLobby'>) {
  useLocale();
  const { state, retry, remove, close } = useHostRoom(
    route.params?.resume === true,
  );
  const [removing, setRemoving] = useState<RosterPlayer | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [left, setLeft] = useState(false);
  const pendingAction = useRef<NavigationAction | null>(null);

  usePreventRemove(state.phase === 'ready' && !left, ({ data }) => {
    pendingAction.current = data.action;
    setConfirmClose(true);
  });

  useEffect(() => {
    if (!left) {
      return;
    }
    if (pendingAction.current) {
      navigation.dispatch(pendingAction.current);
    } else {
      navigation.goBack();
    }
  }, [left, navigation]);

  const confirmRemove = () => {
    if (removing) {
      haptics.warning();
      remove(removing.seatId);
      setRemoving(null);
    }
  };

  const closeRoom = () => {
    haptics.warning();
    setConfirmClose(false);
    close();
    setLeft(true);
  };

  return (
    <ThemeProvider scheme={campScheme}>
      <Screen testID="camp.lobby.screen" scroll>
        <View style={layout.header}>
          <AppText variant="caption">{t('camp.lobby.youHost')}</AppText>
          <AppText variant="h1" accessibilityRole="header">
            {t('camp.lobby.room')}
          </AppText>
          {state.phase === 'ready' ? (
            <StatusChip
              testID="camp.lobby.chip"
              variant="go"
              label={chipLabel(state.network)}
            />
          ) : null}
        </View>

        {state.phase === 'starting' ? (
          <View
            testID="camp.lobby.loading"
            accessibilityLabel={t('common.loading')}
            style={layout.section}
          >
            <Skeleton
              height={lobbySizes.qr + lobbySizes.codeFont * 3}
              radius={radii.card}
            />
            <Skeleton height={lobbySizes.seat} />
          </View>
        ) : null}

        {state.phase === 'error' ? (
          <EmptyState
            testID="camp.lobby.error"
            mascot="worried"
            mascotLabel={t('camp.lobby.hotspotError')}
            title={t('camp.lobby.hotspotError')}
            body={
              state.permissionDenied ? t('camp.lobby.permission') : undefined
            }
            action={
              <AppButton
                testID="camp.lobby.retry"
                label={t('camp.lobby.tryAgain')}
                variant="secondary"
                onPress={retry}
              />
            }
          />
        ) : null}

        {state.phase === 'ready' ? (
          <>
            <RoomQr
              joinUrl={state.joinUrl}
              code={state.room.code}
              ssid={
                state.network.mode === 'hotspot' ? state.network.ssid : null
              }
            />
            <Players
              players={toRoster(state.room)}
              reconnecting={reconnectingCount(state.room)}
              onRemove={player => {
                haptics.tap();
                setRemoving(player);
              }}
            />
            <Games />
            <View style={layout.section}>
              <AppButton
                testID="camp.lobby.start"
                label={t('camp.lobby.start')}
                variant="secondary"
                disabled
                onPress={noop}
              />
              <AppText variant="small" style={layout.center}>
                {t('camp.lobby.startSoon')}
              </AppText>
            </View>
            <AppButton
              testID="camp.lobby.close"
              label={t('camp.lobby.close')}
              variant="white"
              onPress={() => {
                pendingAction.current = null;
                setConfirmClose(true);
              }}
            />
          </>
        ) : null}

        {removing ? (
          <ConfirmSheet
            testID="camp.lobby.remove-sheet"
            title={t('camp.lobby.removeConfirm', { name: removing.nickname })}
            confirmLabel={t('camp.lobby.remove')}
            confirmTestID="camp.lobby.remove-confirm"
            cancelTestID="camp.lobby.remove-cancel"
            onConfirm={confirmRemove}
            onDismiss={() => setRemoving(null)}
          />
        ) : null}
        {confirmClose ? (
          <ConfirmSheet
            testID="camp.lobby.close-sheet"
            title={t('camp.lobby.closeConfirm')}
            confirmLabel={t('camp.lobby.close')}
            confirmTestID="camp.lobby.close-confirm"
            cancelTestID="camp.lobby.close-cancel"
            onConfirm={closeRoom}
            onDismiss={() => setConfirmClose(false)}
          />
        ) : null}
      </Screen>
    </ThemeProvider>
  );
}

function Players({
  players,
  reconnecting,
  onRemove,
}: {
  players: RosterPlayer[];
  reconnecting: number;
  onRemove: (player: RosterPlayer) => void;
}) {
  const onlyHost = players.length <= 1;
  return (
    <View style={layout.section}>
      <View style={layout.row}>
        <AppText
          testID="camp.lobby.count"
          variant="h3"
          accessibilityRole="header"
          style={layout.flex}
        >
          {t('camp.lobby.players', { n: players.length })}
        </AppText>
        <AppText variant="small">
          {reconnecting > 0
            ? t('camp.lobby.reconnectingCount', { k: reconnecting })
            : t('camp.lobby.allConnected')}
        </AppText>
      </View>
      <View style={layout.grid}>
        {players.map(player => (
          <PlayerAvatar
            key={player.seatId}
            player={player}
            onLongPress={player.host ? undefined : () => onRemove(player)}
          />
        ))}
      </View>
      {onlyHost ? (
        <AppText testID="camp.lobby.empty" variant="body" tone="muted">
          {t('camp.lobby.empty')}
        </AppText>
      ) : null}
    </View>
  );
}

function Games() {
  const styles = useStyles();
  const { show } = useToast();
  return (
    <View style={layout.section}>
      <AppText variant="h3" accessibilityRole="header">
        {t('camp.lobby.game')}
      </AppText>
      <View style={layout.grid}>
        {lobbyGames.map(game => {
          const selected = game === SELECTED_GAME;
          return (
            <Pressable
              key={game}
              testID={`camp.lobby.game.${game}`}
              accessibilityLabel={`${gameLabel(game)}, ${t('camp.comingSoon')}`}
              accessibilityState={{ selected }}
              onPress={() => {
                haptics.selection();
                show({ variant: 'info', message: t('camp.comingSoonToast') });
              }}
              style={[
                layout.pill,
                styles.pill,
                selected && layout.pillSelected,
              ]}
            >
              <AppText variant="chip">{gameLabel(game)}</AppText>
              <ComingSoonTag />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

type ConfirmProps = {
  testID: string;
  title: string;
  confirmLabel: string;
  confirmTestID: string;
  cancelTestID: string;
  onConfirm: () => void;
  onDismiss: () => void;
};

function ConfirmSheet({
  testID,
  title,
  confirmLabel,
  confirmTestID,
  cancelTestID,
  onConfirm,
  onDismiss,
}: ConfirmProps) {
  return (
    <Sheet testID={testID} accessibilityLabel={title} onDismiss={onDismiss}>
      <View style={layout.section}>
        <AppText variant="h3" accessibilityRole="header">
          {title}
        </AppText>
        <AppButton
          testID={confirmTestID}
          label={confirmLabel}
          variant="danger"
          onPress={onConfirm}
        />
        <AppButton
          testID={cancelTestID}
          label={t('common.cancel')}
          variant="white"
          onPress={onDismiss}
        />
      </View>
    </Sheet>
  );
}

const layout = StyleSheet.create({
  header: { gap: spacing[6], alignItems: 'flex-start' },
  section: { gap: spacing[12] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[12] },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[12] },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[6],
    borderRadius: radii.pill,
    borderWidth: borders.card,
  },
  pillSelected: { borderColor: palette.purple },
});

const useStyles = createThemedStyles(c => ({
  pill: { backgroundColor: c.card, borderColor: c.line },
}));
