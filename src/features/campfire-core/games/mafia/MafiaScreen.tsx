import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '../../../../shared/components/AppText';
import { borders, radii, spacing } from '../../../../shared/constants/spacing';
import { createThemedStyles } from '../../../../shared/contexts/theme';
import { t } from '../../../../shared/i18n';
import { haptics } from '../../../../shared/utils/haptics';
import { qaLog } from '../../../../shared/utils/qaLog';
import type {
  MafiaPublic,
  MafiaSecret,
  MafiaWinner,
  RosterPlayer,
} from '../../protocol/codec';
import { toMafiaPublic, type MafiaState } from '../gameReducer';
import { GameOver } from './GameOver';
import { HostControl } from './HostControl';
import { fateLabel, OutList, phaseLabel } from './OutList';
import { RoleCard } from './RoleCard';
import { dealtRoles, winCheck, type MafiaWinningTeam } from './winCheck';
import { WinSheet } from './WinSheet';

export type MafiaHostControls = {
  onPhaseNext: () => void;
  onMarkOut: (seatId: string) => void;
  onMarkBack: (seatId: string) => void;
  onEnd: (winner: MafiaWinner) => void;
  onLobby: () => void;
  onPlayAgain: () => void;
};

/** The winner the host's game points to now (AC6), or null. */
export function mafiaWinner(game: MafiaState): MafiaWinningTeam | null {
  return winCheck(
    dealtRoles(game.players, game.deals),
    game.out.map(entry => entry.seatId),
  );
}

type Props =
  | {
      kind: 'host';
      game: MafiaState;
      roster: RosterPlayer[];
      controls: MafiaHostControls;
    }
  | {
      kind: 'player';
      round: number;
      info: MafiaPublic;
      secret: MafiaSecret;
      selfSeatId: string | null;
      roster: RosterPlayer[];
      onReady: () => void;
    };

/** Mafia on every phone: the narrator's control (AC4) or the player's view with its card (AC3, AC5). */
export function MafiaScreen(props: Props) {
  if (props.kind === 'host') {
    const { game, roster, controls } = props;
    const info = toMafiaPublic(game);
    if (info.ended) {
      return (
        <GameOver
          key={game.round}
          phase={info.phase}
          winner={info.ended.winner}
          roles={info.ended.roles}
          out={info.out}
          roster={roster}
          host={{ onLobby: controls.onLobby, onPlayAgain: controls.onPlayAgain }}
        />
      );
    }
    return <HostView key={game.round} {...props} />;
  }
  if (props.info.ended) {
    return (
      <GameOver
        key={props.round}
        phase={props.info.phase}
        winner={props.info.ended.winner}
        roles={props.info.ended.roles}
        out={props.info.out}
        roster={props.roster}
      />
    );
  }
  return <PlayerView key={props.round} {...props} />;
}

type HostProps = Extract<Props, { kind: 'host' }>;

/** The narrator's control plus the win question after each mark (asked once per out-set). */
function HostView({ game, roster, controls }: HostProps) {
  const [dismissed, setDismissed] = useState<string | null>(null);
  const winner = mafiaWinner(game);
  const outSet = game.out
    .map(entry => entry.seatId)
    .sort()
    .join(',');
  const asking = winner !== null && dismissed !== outSet;

  useEffect(() => {
    if (winner && asking) {
      qaLog('maf_win_suggested', { winner });
    }
  }, [winner, asking, outSet]);

  return (
    <>
      <HostControl
        game={game}
        roster={roster}
        onPhaseNext={controls.onPhaseNext}
        onMarkOut={controls.onMarkOut}
        onMarkBack={controls.onMarkBack}
      />
      {winner && asking ? (
        <WinSheet
          winner={winner}
          onEnd={() => {
            haptics.warning();
            controls.onEnd(winner);
          }}
          onKeepPlaying={() => setDismissed(outSet)}
        />
      ) : null}
    </>
  );
}

type PlayerProps = Extract<Props, { kind: 'player' }>;

function PlayerView({ info, secret, selfSeatId, roster, onReady }: PlayerProps) {
  const styles = useStyles();
  const [ready, setReady] = useState(false);
  const ownOut = info.out.find(entry => entry.seatId === selfSeatId);
  const isOut = ownOut !== undefined;
  const wasOut = useRef(isOut);

  useEffect(() => {
    if (isOut && !wasOut.current) {
      haptics.heavy();
    }
    wasOut.current = isOut;
  }, [isOut]);

  const others = roster.filter(player => !player.host);
  const seat = others.findIndex(player => player.seatId === selfSeatId) + 1;
  const nickname =
    roster.find(player => player.seatId === selfSeatId)?.nickname ?? '';

  return (
    <View testID="maf.player" style={layout.root}>
      <View style={layout.header}>
        <AppText variant="h1" accessibilityRole="header">
          {phaseLabel(info.phase)}
        </AppText>
        <AppText variant="small">
          {t('camp.maf.aliveLine', {
            a: info.playerCount - info.out.length,
            n: info.playerCount,
          })}
        </AppText>
      </View>

      {ownOut ? (
        <View
          testID="maf.out-banner"
          accessibilityRole="alert"
          style={[layout.banner, styles.banner]}
        >
          <AppText variant="h3" tone="white">
            {t('camp.maf.youreOut', { fate: fateLabel(ownOut) })}
          </AppText>
        </View>
      ) : null}

      <RoleCard
        roleId={secret.roleId}
        seat={seat}
        nickname={nickname}
        readyCount={info.readyCount}
        playerCount={info.playerCount}
        ready={ready}
        onReady={() => {
          if (ready) {
            return;
          }
          haptics.success();
          setReady(true);
          onReady();
        }}
      />

      <OutList out={info.out} roster={roster} />
    </View>
  );
}

const layout = StyleSheet.create({
  root: { gap: spacing[20] },
  header: { gap: spacing[6] },
  banner: {
    padding: spacing[16],
    borderRadius: radii.card,
    borderWidth: borders.card,
  },
});

const useStyles = createThemedStyles(c => ({
  banner: { backgroundColor: c.red700, borderColor: c.red700 },
}));
