import { StyleSheet, View } from 'react-native';

import { AppButton } from '../../../../shared/components/AppButton';
import { AppText } from '../../../../shared/components/AppText';
import { Sheet } from '../../../../shared/components/Sheet';
import { spacing } from '../../../../shared/constants/spacing';
import { t } from '../../../../shared/i18n';
import type { MafiaPhase } from '../../protocol/codec';

type Props = {
  nickname: string;
  phase: MafiaPhase;
  /** The player is already out: only "Back in game". */
  out: boolean;
  onMarkOut: () => void;
  onMarkBack: () => void;
  onDismiss: () => void;
};

/** Narrator's action sheet for one player (AC4): killed at night, exiled by day, or back in game. */
export function PlayerSheet({
  nickname,
  phase,
  out,
  onMarkOut,
  onMarkBack,
  onDismiss,
}: Props) {
  const night = phase.kind === 'night';
  return (
    <Sheet testID="maf.sheet" accessibilityLabel={nickname} onDismiss={onDismiss}>
      <View style={layout.section}>
        <AppText variant="h3" accessibilityRole="header">
          {nickname}
        </AppText>
        {out ? (
          <AppButton
            testID="maf.sheet.back"
            label={t('camp.maf.markBack')}
            variant="secondary"
            onPress={onMarkBack}
          />
        ) : (
          <AppButton
            testID={night ? 'maf.sheet.killed' : 'maf.sheet.exiled'}
            label={t(night ? 'camp.maf.markKilled' : 'camp.maf.markExiled')}
            variant="danger"
            onPress={onMarkOut}
          />
        )}
        <AppButton
          testID="maf.sheet.cancel"
          label={t('common.cancel')}
          variant="white"
          onPress={onDismiss}
        />
      </View>
    </Sheet>
  );
}

const layout = StyleSheet.create({
  section: { gap: spacing[12] },
});
