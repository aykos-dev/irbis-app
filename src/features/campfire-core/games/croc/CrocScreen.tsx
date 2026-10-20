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
import { CrocSecret } from './CrocSecret';

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
};

/** Crocodile on every phone: pick (host list / wait), then the describer's card or who is showing. */
export function CrocScreen({
  phase,
  info,
  secret,
  roster,
  onPick,
  onSkip,
  onStart,
}: Props) {
  const describer = roster.find(
    player => player.seatId === info.describerSeatId,
  );
  return (
    <View testID="croc.screen" style={layout.section}>
      <AppText variant="h1" accessibilityRole="header">
        {t('camp.games.croc')}
      </AppText>
      {phase === 'pick' ? <CrocPick roster={roster} onPick={onPick} /> : null}
      {phase !== 'pick' && secret ? (
        <CrocSecret
          key={secret.turnNo}
          phase={phase}
          secret={secret}
          onSkip={onSkip}
          onStart={onStart}
        />
      ) : null}
      {phase !== 'pick' && !secret ? (
        <View testID="croc.showing" style={layout.showing}>
          {describer ? (
            <SeatAvatar avatar={describer.avatar} size={partySizes.rowAvatar} />
          ) : null}
          <AppText variant="h2" style={layout.center}>
            {t('camp.croc.showing', { name: describer?.nickname ?? '' })}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const layout = StyleSheet.create({
  section: { gap: spacing[16] },
  showing: { alignItems: 'center', gap: spacing[12], paddingVertical: spacing[20] },
  center: { textAlign: 'center' },
});
