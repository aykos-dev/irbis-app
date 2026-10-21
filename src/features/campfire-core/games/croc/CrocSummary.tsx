import { StyleSheet, View } from 'react-native';

import { AppButton } from '../../../../shared/components/AppButton';
import { AppText } from '../../../../shared/components/AppText';
import { spacing } from '../../../../shared/constants/spacing';
import { t } from '../../../../shared/i18n';
import { haptics } from '../../../../shared/utils/haptics';
import type { CrocTotals } from '../../protocol/codec';
import { Confetti } from '../mafia/GameOver';

type Props = {
  totals: CrocTotals;
  /** The host's buttons; everyone else waits for the host. */
  host?: { onPlayAgain: () => void; onLobby: () => void };
};

/** Game over on every phone (AC7): the totals, confetti, and the host's Play again / Lobby. */
export function CrocSummary({ totals, host }: Props) {
  return (
    <View testID="croc.summary" style={layout.root}>
      <Confetti />
      <View style={layout.header}>
        <AppText variant="h1" accessibilityRole="header">
          {t('camp.croc.over')}
        </AppText>
        <AppText testID="croc.summary.totals" variant="body" style={layout.center}>
          {t('camp.croc.totals', {
            g: totals.guessed,
            s: totals.skipped,
            t: totals.turns,
          })}
        </AppText>
      </View>
      {host ? (
        <View style={layout.buttons}>
          <AppButton
            testID="croc.play-again"
            label={t('camp.maf.playAgain')}
            onPress={() => {
              haptics.tap();
              host.onPlayAgain();
            }}
          />
          <AppButton
            testID="croc.lobby"
            label={t('camp.maf.lobby')}
            variant="white"
            onPress={() => {
              haptics.tap();
              host.onLobby();
            }}
          />
        </View>
      ) : (
        <AppText
          testID="croc.wait-host"
          variant="body"
          tone="muted"
          style={layout.center}
        >
          {t('camp.maf.waitHost')}
        </AppText>
      )}
    </View>
  );
}

const layout = StyleSheet.create({
  root: { gap: spacing[20] },
  header: { gap: spacing[6], alignItems: 'center' },
  buttons: { gap: spacing[12] },
  center: { textAlign: 'center' },
});
