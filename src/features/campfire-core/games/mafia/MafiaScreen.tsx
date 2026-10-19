import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '../../../../shared/components/AppText';
import { borders, radii, spacing } from '../../../../shared/constants/spacing';
import { createThemedStyles } from '../../../../shared/contexts/theme';
import { t } from '../../../../shared/i18n';
import { haptics } from '../../../../shared/utils/haptics';
import type {
  MafiaPublic,
  MafiaSecret,
  RosterPlayer,
} from '../../protocol/codec';
import type { MafiaState } from '../gameReducer';
import { HostControl } from './HostControl';
import { fateLabel, OutList, phaseLabel } from './OutList';
import { RoleCard } from './RoleCard';

export type MafiaHostControls = {
  onPhaseNext: () => void;
  onMarkOut: (seatId: string) => void;
  onMarkBack: (seatId: string) => void;
};

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
    return (
      <HostControl
        game={props.game}
        roster={props.roster}
        onPhaseNext={props.controls.onPhaseNext}
        onMarkOut={props.controls.onMarkOut}
        onMarkBack={props.controls.onMarkBack}
      />
    );
  }
  return <PlayerView key={props.round} {...props} />;
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
