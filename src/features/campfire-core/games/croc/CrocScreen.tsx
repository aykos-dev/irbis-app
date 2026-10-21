import { StyleSheet, View } from 'react-native';

import { AppText } from '../../../../shared/components/AppText';
import { spacing } from '../../../../shared/constants/spacing';
import { t } from '../../../../shared/i18n';
import { partySizes } from '../../campTheme';
import type {
  CrocPhase,
  CrocPublic,
  CrocSecret as Secret,
  RosterPlayer,
} from '../../protocol/codec';
import { SeatAvatar } from '../components/SeatAvatar';
import { CrocPick } from './CrocPick';
import { CrocResult } from './CrocResult';
import { CrocSecret } from './CrocSecret';
import { CrocSummary } from './CrocSummary';
import { CrocTimer } from './CrocTimer';

/** The host's controls after a turn and after the game. */
export type CrocHostControls = {
  onNext: () => void;
  onPlayAgain: () => void;
  onLobby: () => void;
};

type Props = {
  phase: CrocPhase;
  info: CrocPublic;
  /** This phone's word card: set only when it is the describer's. */
  secret: Secret | null;
  roster: RosterPlayer[];
  /** Host only: picks who shows next. */
  onPick?: (seatId: string) => void;
  onSkip: () => void;
  onStart: () => void;
  onGuessed: () => void;
  /** Host only. */
  host?: CrocHostControls;
};

/**
 * Crocodile on every phone: pick (host list / wait), the describer's card or who is showing, the
 * turn timer, the turn's result and the game-over totals.
 */
export function CrocScreen({
  phase,
  info,
  secret,
  roster,
  onPick,
  onSkip,
  onStart,
  onGuessed,
  host,
}: Props) {
  const describer = roster.find(
    player => player.seatId === info.describerSeatId,
  );
  const turn = phase === 'ready' || phase === 'running';
  if (phase === 'ended') {
    return (
      <View testID="croc.screen" style={layout.section}>
        <CrocSummary
          totals={info.totals}
          host={
            host
              ? { onPlayAgain: host.onPlayAgain, onLobby: host.onLobby }
              : undefined
          }
        />
      </View>
    );
  }
  return (
    <View testID="croc.screen" style={layout.section}>
      <AppText variant="h1" accessibilityRole="header">
        {t('camp.games.croc')}
      </AppText>
      {phase === 'pick' ? <CrocPick roster={roster} onPick={onPick} /> : null}
      {phase === 'running' && info.remainingMs !== undefined ? (
        <CrocTimer
          remainingMs={info.remainingMs}
          durationSec={info.durationSec}
        />
      ) : null}
      {turn && secret ? (
        <CrocSecret
          key={secret.turnNo}
          phase={phase}
          secret={secret}
          onSkip={onSkip}
          onStart={onStart}
          onGuessed={onGuessed}
        />
      ) : null}
      {turn && !secret ? (
        <View testID="croc.showing" style={layout.showing}>
          {describer ? (
            <SeatAvatar avatar={describer.avatar} size={partySizes.rowAvatar} />
          ) : null}
          <AppText variant="h2" style={layout.center}>
            {t('camp.croc.showing', { name: describer?.nickname ?? '' })}
          </AppText>
        </View>
      ) : null}
      {phase === 'result' && info.result ? (
        <CrocResult
          key={info.turnNo}
          result={info.result}
          onNext={host?.onNext}
        />
      ) : null}
    </View>
  );
}

const layout = StyleSheet.create({
  section: { gap: spacing[16] },
  showing: { alignItems: 'center', gap: spacing[12], paddingVertical: spacing[20] },
  center: { textAlign: 'center' },
});
