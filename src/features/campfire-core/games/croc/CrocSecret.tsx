import { StyleSheet, View } from 'react-native';

import { AppButton } from '../../../../shared/components/AppButton';
import { AppText } from '../../../../shared/components/AppText';
import { spacing } from '../../../../shared/constants/spacing';
import { t } from '../../../../shared/i18n';
import { haptics } from '../../../../shared/utils/haptics';
import type { CrocPhase, CrocSecret as Secret } from '../../protocol/codec';
import { SecretCard } from '../components/SecretCard';
import { findCrocPack, localized } from '../packs';
import { useSecureScreen } from '../useSecureScreen';

type Props = {
  phase: CrocPhase;
  secret: Secret;
  onSkip: () => void;
  onStart: () => void;
};

/** The word in this phone's language; empty when the pack or word is unknown here. */
function wordText(secret: Secret): { word: string; pack: string } {
  const pack = findCrocPack(secret.pack);
  const item = pack?.items.find(candidate => candidate.id === secret.word);
  return {
    word: item ? localized(item) : '',
    pack: pack ? localized(pack.name) : '',
  };
}

/**
 * The describer's card (AC3): hold to see the word and its pack (screen kept secure), the rule,
 * Skip for another word and Start before the turn begins.
 */
export function CrocSecret({ phase, secret, onSkip, onStart }: Props) {
  const { captured } = useSecureScreen();
  const { word, pack } = wordText(secret);
  return (
    <View style={layout.section}>
      <View testID="croc.card">
        <SecretCard captured={captured}>
          <View style={layout.word}>
            <AppText testID="croc.word" variant="h1" style={layout.center}>
              {word}
            </AppText>
            <AppText variant="small" tone="muted">
              {pack}
            </AppText>
          </View>
        </SecretCard>
      </View>
      <AppText testID="croc.rule" variant="body" style={layout.center}>
        {t('camp.croc.rule')}
      </AppText>
      {phase === 'ready' ? (
        <View style={layout.buttons}>
          <View style={layout.flex}>
            <AppButton
              testID="croc.skip"
              label={t('camp.croc.skip')}
              variant="white"
              onPress={() => {
                haptics.tap();
                onSkip();
              }}
            />
          </View>
          <View style={layout.flex}>
            <AppButton
              testID="croc.start"
              label={t('camp.croc.start')}
              variant="secondary"
              onPress={() => {
                haptics.success();
                onStart();
              }}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const layout = StyleSheet.create({
  section: { gap: spacing[16] },
  word: { alignItems: 'center', gap: spacing[8], paddingVertical: spacing[20] },
  center: { textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: spacing[12] },
  flex: { flex: 1 },
});
