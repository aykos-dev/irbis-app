import { StyleSheet, View } from 'react-native';

import { AppButton } from '../../../../shared/components/AppButton';
import { AppText } from '../../../../shared/components/AppText';
import { Sheet } from '../../../../shared/components/Sheet';
import { spacing } from '../../../../shared/constants/spacing';
import { t } from '../../../../shared/i18n';
import type { MafiaWinningTeam } from './winCheck';

type Props = {
  winner: MafiaWinningTeam;
  onEnd: () => void;
  onKeepPlaying: () => void;
};

/** The narrator's "Town wins?" question (AC6): end the game with that winner or keep playing. */
export function WinSheet({ winner, onEnd, onKeepPlaying }: Props) {
  const title = t(`camp.maf.winQ.${winner}`);
  return (
    <Sheet
      testID="maf.win-sheet"
      accessibilityLabel={title}
      onDismiss={onKeepPlaying}
    >
      <View style={layout.section}>
        <AppText variant="h3" accessibilityRole="header">
          {title}
        </AppText>
        <AppButton
          testID="maf.win-end"
          label={t('camp.maf.endGame')}
          onPress={onEnd}
        />
        <AppButton
          testID="maf.win-keep"
          label={t('camp.maf.keepPlaying')}
          variant="white"
          onPress={onKeepPlaying}
        />
      </View>
    </Sheet>
  );
}

const layout = StyleSheet.create({
  section: { gap: spacing[12] },
});
