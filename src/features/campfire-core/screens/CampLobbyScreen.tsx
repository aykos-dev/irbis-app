import {
  useIsFocused,
  usePreventRemove,
  type NavigationAction,
} from '@react-navigation/native';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import type { RootStackScreenProps } from '../../../app/navigation/types';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { EmptyState } from '../../../shared/components/EmptyState';
import { ListCard, ListRow } from '../../../shared/components/ListRow';
import { Pressable } from '../../../shared/components/Pressable';
import { Screen } from '../../../shared/components/Screen';
import { Sheet } from '../../../shared/components/Sheet';
import { Skeleton } from '../../../shared/components/Skeleton';
import { StatusChip } from '../../../shared/components/StatusChip';
import { useToast } from '../../../shared/components/Toast';
import { conditionColors, palette } from '../../../shared/constants/colors';
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
import { useAppState } from '../../../shared/hooks/useAppState';
import { useLocale } from '../../../shared/hooks/useLocale';
import { t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { campColors, campScheme, lobbySizes, type GameId } from '../campTheme';
import { ConfirmSheet } from '../components/ConfirmSheet';
import {
  inRange,
  playerRange,
  TWO_IMPOSTERS_FROM,
  xoRange,
  type GameSettings,
} from '../games/gameReducer';
import { MafiaSetup } from '../games/mafia/MafiaSetup';
import {
  localized,
  packsFor,
  partyGames,
  type Pack,
  type PartyGame,
} from '../games/packs';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { RoomQr } from '../components/RoomQr';
import { useHostBattery } from '../hooks/useHostBattery';
import { playerSession, type PlayerClient } from '../join/playerClient';
import type { RosterPlayer } from '../protocol/codec';
import { reconnectingCount, toRoster } from '../room/roomReducer';
import { useHostRoom, type HostNetwork } from '../room/useHostRoom';

const lobbyGames: GameId[] = ['imposter', 'mafia', 'whoami', 'rather', 'xo'];

function isPartyGame(game: GameId): game is PartyGame {
  return partyGames.some(party => party === game);
}

const firstPacks = (): Record<PartyGame, string> => ({
  imposter: packsFor('imposter')[0]?.id ?? '',
  whoami: packsFor('whoami')[0]?.id ?? '',
  rather: packsFor('rather')[0]?.id ?? '',
});

const countKey: Record<PartyGame, string> = {
  imposter: 'camp.game.words',
  whoami: 'camp.game.characters',
  rather: 'camp.game.questions',
};

/** `<name> · <n> words` in the app language. */
function packLabel(pack: Pack): string {
  return `${localized(pack.name)} · ${t(countKey[pack.game], { count: pack.items.length })}`;
}

/** Why Start is disabled for this many connected players, or null when it is enabled. */
function startBlocked(game: PartyGame, players: number): string | null {
  const { min, max } = playerRange[game];
  if (players < min) {
    return t('camp.game.needsMin', { n: min });
  }
  return players > max ? t('camp.game.max', { n: max }) : null;
}

function gameLabel(game: GameId): string {
  return game === 'rather'
    ? t('camp.lobby.gameRather')
    : t(`camp.games.${game}`);
}

function chipLabel(network: HostNetwork): string {
  return network.mode === 'hotspot' ||
    (network.mode === 'ios' && network.hotspot)
    ? t('camp.lobby.hotspotOn')
    : t('camp.lobby.wifiChip', { name: network.name });
}

/** Line under the code: hotspot password is in the QR (Android), or join in Settings (iPhone). */
function qrNote(network: HostNetwork): string | null {
  if (network.mode === 'hotspot') {
    return t('camp.lobby.pwInQr');
  }
  return network.mode === 'ios' ? t('camp.lobby.iosJoinFirst') : null;
}

/** The host's lobby, or the seated player's when opened with `player` (AC6). */
export function CampLobbyScreen(props: RootStackScreenProps<'CampLobby'>) {
  const client = props.route.params?.player ? playerSession.get() : null;
  if (props.route.params?.player) {
    return <PlayerLobby {...props} client={client} />;
  }
  return <HostLobby {...props} />;
}

/**
 * Host lobby (AC4, AC6, AC7 host side): hotspot or Wi-Fi, room server, QR and code, seats with
 * remove, game pills (coming soon), close with confirm. Back asks before closing the room.
 */
function HostLobby({ navigation, route }: RootStackScreenProps<'CampLobby'>) {
  useLocale();
  const { state, retry, remove, close, startGame, startMafia, startXo } = useHostRoom(
    route.params?.resume === true,
  );
  const [game, setGame] = useState<GameId>(
    route.params?.game ?? 'imposter',
  );
  const [packIds, setPackIds] = useState(firstPacks);
  const [imposters, setImposters] = useState(1);
  const [showCategory, setShowCategory] = useState(true);
  const [picking, setPicking] = useState(false);
  const inGame = state.phase === 'ready' && state.game !== null;
  const [removing, setRemoving] = useState<RosterPlayer | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [left, setLeft] = useState(false);
  const pendingAction = useRef<NavigationAction | null>(null);
  const batteryPct = useHostBattery(
    state.phase === 'ready' ? state.room.code : null,
  );

  usePreventRemove(state.phase === 'ready' && !left, ({ data }) => {
    pendingAction.current = data.action;
    setConfirmClose(true);
  });

  // Start (or a resumed room with a game) → the game route on the host too (AC2).
  useEffect(() => {
    if (inGame) {
      navigation.navigate('CampGame');
    }
  }, [inGame, navigation]);

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

  const connected =
    state.phase === 'ready'
      ? state.room.seats.filter(seat => seat.status === 'connected').length
      : 0;
  const twoImposters = connected >= TWO_IMPOSTERS_FROM;

  const start = () => {
    if (!isPartyGame(game)) {
      return;
    }
    const settings: GameSettings = {
      packId: packIds[game],
      imposters: twoImposters ? imposters : 1,
      showCategory,
    };
    haptics.success();
    startGame(game, settings);
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

        {batteryPct !== null ? (
          <View
            testID="camp.lobby.battery"
            style={layout.battery}
            accessible
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            <AppText variant="small" style={layout.batteryText}>
              {t('camp.lobby.battery', { pct: batteryPct })}
            </AppText>
          </View>
        ) : null}

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
              note={qrNote(state.network)}
            />
            <Players
              players={toRoster(state.room)}
              reconnecting={reconnectingCount(state.room)}
              onRemove={player => {
                haptics.tap();
                setRemoving(player);
              }}
            />
            <Games
              selected={game}
              onSelect={next => {
                haptics.selection();
                setGame(next);
              }}
            />
            {isPartyGame(game) ? (
              <>
                <Settings
                  game={game}
                  packId={packIds[game]}
                  imposters={twoImposters ? imposters : 1}
                  twoImposters={twoImposters}
                  showCategory={showCategory}
                  onPickPack={() => {
                    haptics.tap();
                    setPicking(true);
                  }}
                  onImposters={() => {
                    haptics.selection();
                    setImposters(value => (value === 1 ? 2 : 1));
                  }}
                  onShowCategory={value => {
                    haptics.selection();
                    setShowCategory(value);
                  }}
                />
                <View style={layout.section}>
                  <AppButton
                    testID="camp.lobby.start"
                    label={t('camp.game.start', {
                      game: t(`camp.game.name.${game}`),
                    })}
                    variant="secondary"
                    disabled={!inRange(game, connected)}
                    onPress={start}
                  />
                  {startBlocked(game, connected) ? (
                    <AppText
                      testID="camp.lobby.start-reason"
                      variant="small"
                      style={layout.center}
                    >
                      {startBlocked(game, connected)}
                    </AppText>
                  ) : null}
                  <AppText variant="small" tone="muted" style={layout.center}>
                    {t('camp.game.youPlayToo')}
                  </AppText>
                </View>
              </>
            ) : game === 'xo' ? (
              <XoStart
                players={connected}
                onStart={() => {
                  haptics.success();
                  startXo();
                }}
              />
            ) : (
              <MafiaSetup
                players={Math.max(0, connected - 1)}
                onDeal={startMafia}
              />
            )}
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

        {picking && isPartyGame(game) ? (
          <PackSheet
            game={game}
            selected={packIds[game]}
            onPick={packId => {
              haptics.selection();
              setPackIds(current => ({ ...current, [game]: packId }));
              setPicking(false);
            }}
            onDismiss={() => setPicking(false)}
          />
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

/**
 * Player lobby (AC6, AC7 player side): the live roster from the host, "waiting for the host",
 * Leave. A drop shows "Reconnecting…" while the client retries every 2 s and on foreground;
 * removed / closed → toast and back to the hub. Back leaves the room too.
 */
function PlayerLobby({
  navigation,
  client,
}: RootStackScreenProps<'CampLobby'> & { client: PlayerClient | null }) {
  useLocale();
  const { show } = useToast();
  const appState = useAppState();
  const focused = useIsFocused();
  const snapshot = useSyncExternalStore(
    client?.subscribe ?? noSubscribe,
    client?.getSnapshot ?? noSnapshot,
  );

  useEffect(() => {
    client?.setActive(appState !== 'background');
  }, [client, appState]);

  // Unmount (Leave, Back, removed / closed): the seat is given up unless the host already ended it.
  useEffect(
    () => () => {
      if (client && !client.getSnapshot().ended) {
        client.leave();
      }
      playerSession.set(null);
    },
    [client],
  );

  // The host started a round (or we joined mid-game) → the game route (AC2). Also when Back brings
  // this lobby back into focus while a game is still running: never strand the joiner here.
  const inGame = Boolean(snapshot?.game) && !snapshot?.ended;
  useEffect(() => {
    if (inGame && focused) {
      navigation.navigate('CampGame', { player: true });
    }
  }, [focused, inGame, navigation]);

  const ended = snapshot?.ended ?? (client ? null : 'left');
  useEffect(() => {
    if (!ended) {
      return;
    }
    if (ended === 'removed' || ended === 'closed') {
      haptics.warning();
      show({
        variant: 'info',
        message: t(ended === 'removed' ? 'camp.join.removed' : 'camp.join.closed'),
      });
    }
    navigation.popToTop();
  }, [ended, navigation, show]);

  const players = snapshot?.players ?? [];
  return (
    <ThemeProvider scheme={campScheme}>
      <Screen testID="camp.lobby.screen" scroll>
        <View style={layout.header}>
          <AppText variant="h1" accessibilityRole="header">
            {t('camp.lobby.room')}
          </AppText>
          {snapshot?.status === 'reconnecting' ? (
            <StatusChip
              testID="camp.lobby.reconnecting"
              variant="caution"
              label={t('camp.lobby.reconnectingSelf')}
            />
          ) : null}
        </View>
        <Players
          players={players}
          reconnecting={players.filter(p => p.status === 'reconnecting').length}
        />
        <AppText testID="camp.lobby.wait" variant="body" tone="muted" style={layout.center}>
          {t('camp.lobby.waitHost')}
        </AppText>
        <AppButton
          testID="camp.lobby.leave"
          label={t('camp.lobby.leave')}
          variant="white"
          onPress={() => {
            haptics.tap();
            navigation.popToTop();
          }}
        />
      </Screen>
    </ThemeProvider>
  );
}

const noSubscribe = () => () => undefined;
const noSnapshot = () => null;

function Players({
  players,
  reconnecting,
  onRemove,
}: {
  players: RosterPlayer[];
  reconnecting: number;
  /** Host only: long-press a player to remove them. */
  onRemove?: (player: RosterPlayer) => void;
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
            onLongPress={
              player.host || !onRemove ? undefined : () => onRemove(player)
            }
          />
        ))}
      </View>
      {onlyHost && onRemove ? (
        <AppText testID="camp.lobby.empty" variant="body" tone="muted">
          {t('camp.lobby.empty')}
        </AppText>
      ) : null}
    </View>
  );
}

/** Game pills (AC1): every game is selectable (Mafia since campfire-mafia AC1). */
function Games({
  selected: current,
  onSelect,
}: {
  selected: GameId;
  onSelect: (game: GameId) => void;
}) {
  const styles = useStyles();
  return (
    <View style={layout.section}>
      <AppText variant="h3" accessibilityRole="header">
        {t('camp.lobby.game')}
      </AppText>
      <View style={layout.grid}>
        {lobbyGames.map(game => {
          const selected = game === current;
          return (
            <Pressable
              key={game}
              testID={`camp.lobby.game.${game}`}
              accessibilityLabel={gameLabel(game)}
              accessibilityState={{ selected }}
              onPress={() => onSelect(game)}
              style={[
                layout.pill,
                styles.pill,
                selected && layout.pillSelected,
              ]}
            >
              <AppText variant="chip">{gameLabel(game)}</AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** X and O Start (campfire-xo AC1): enabled with exactly 2 connected seats, host included. */
function XoStart({ players, onStart }: { players: number; onStart: () => void }) {
  const ready = players >= xoRange.min && players <= xoRange.max;
  return (
    <View style={layout.section}>
      <AppButton
        testID="camp.lobby.start"
        label={t('camp.game.start', { game: t('camp.game.name.xo') })}
        variant="secondary"
        disabled={!ready}
        onPress={onStart}
      />
      {ready ? null : (
        <AppText testID="camp.lobby.start-reason" variant="small" style={layout.center}>
          {t('camp.xo.needTwo')}
        </AppText>
      )}
    </View>
  );
}

/** Settings rows for the selected game (canvas CampLobby). */
function Settings({
  game,
  packId,
  imposters,
  twoImposters,
  showCategory,
  onPickPack,
  onImposters,
  onShowCategory,
}: {
  game: PartyGame;
  packId: string;
  imposters: number;
  /** Two imposters can be picked only with 8+ players. */
  twoImposters: boolean;
  showCategory: boolean;
  onPickPack: () => void;
  onImposters: () => void;
  onShowCategory: (value: boolean) => void;
}) {
  const pack = packsFor(game).find(candidate => candidate.id === packId);
  return (
    <ListCard>
      <ListRow
        testID="camp.lobby.pack"
        first
        icon={null}
        label={t(game === 'imposter' ? 'camp.game.pack' : 'camp.game.packWhoami')}
        value={pack ? packLabel(pack) : undefined}
        onPress={onPickPack}
      />
      {game === 'imposter' ? (
        <>
          <ListRow
            testID="camp.lobby.imposters"
            icon={null}
            label={t('camp.game.imposters')}
            value={String(imposters)}
            onPress={twoImposters ? onImposters : undefined}
          />
          <View style={[layout.switchRow, layout.divider]}>
            <View style={layout.flex}>
              <AppText variant="h3">{t('camp.game.seesCategory')}</AppText>
              <AppText variant="small" tone="muted">
                {t('camp.game.seesCategorySub')}
              </AppText>
            </View>
            <Switch
              testID="camp.lobby.sees-category"
              accessibilityLabel={t('camp.game.seesCategory')}
              accessibilityHint={t('camp.game.seesCategorySub')}
              value={showCategory}
              onValueChange={onShowCategory}
              trackColor={{ true: campColors.teal, false: campColors.line }}
              thumbColor={campColors.white}
            />
          </View>
        </>
      ) : null}
    </ListCard>
  );
}

/** Simple list of the game's packs. */
function PackSheet({
  game,
  selected,
  onPick,
  onDismiss,
}: {
  game: PartyGame;
  selected: string;
  onPick: (packId: string) => void;
  onDismiss: () => void;
}) {
  const styles = useStyles();
  const title = t(game === 'imposter' ? 'camp.game.pack' : 'camp.game.packWhoami');
  return (
    <Sheet testID="camp.lobby.pack-sheet" accessibilityLabel={title} onDismiss={onDismiss}>
      <View style={layout.section}>
        <AppText variant="h3" accessibilityRole="header">
          {title}
        </AppText>
        {packsFor(game).map(pack => {
          const isSelected = pack.id === selected;
          return (
            <Pressable
              key={pack.id}
              testID={`camp.lobby.pack.${pack.id}`}
              accessibilityLabel={packLabel(pack)}
              accessibilityState={{ selected: isSelected }}
              onPress={() => onPick(pack.id)}
              style={[layout.packRow, styles.pill, isSelected && layout.pillSelected]}
            >
              <AppText variant="body">{packLabel(pack)}</AppText>
            </Pressable>
          );
        })}
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    paddingVertical: spacing[14],
    paddingHorizontal: spacing[16],
  },
  divider: { borderTopWidth: borders.card, borderTopColor: campColors.soft },
  packRow: {
    minHeight: sizes.touchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
    borderRadius: radii.tile,
    borderWidth: borders.card,
  },
  battery: {
    backgroundColor: conditionColors.caution.chipBg,
    borderRadius: radii.tile,
    paddingVertical: spacing[10],
    paddingHorizontal: spacing[14],
  },
  batteryText: { color: conditionColors.caution.chipFg },
});

const useStyles = createThemedStyles(c => ({
  pill: { backgroundColor: c.card, borderColor: c.line },
}));
