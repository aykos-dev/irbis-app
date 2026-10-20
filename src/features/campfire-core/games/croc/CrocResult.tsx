import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '../../../../shared/components/AppButton';
import { AppText } from '../../../../shared/components/AppText';
import { spacing } from '../../../../shared/constants/spacing';
import { t } from '../../../../shared/i18n';
import { haptics } from '../../../../shared/utils/haptics';
import type { CrocResult as Result } from '../../protocol/codec';
import { wordText } from './CrocSecret';

type Props = {
  result: Result;
  /** Host only: go on before the ~3 s are up. */
  onNext?: () => void;
};

const title = (result: Result): string => {
  switch (result.kind) {
    case 'guessed':
      return t('camp.croc.guessed');
    case 'timeUp':
      return t('camp.croc.timeUp');
    case 'cancelled':
      return t('camp.croc.left', { name: result.name ?? '' });
  }
};

/** A turn's end on every phone (AC5, AC6): guessed / time up / describer left, and the word in this phone's language. */
export function CrocResult({ result, onNext }: Props) {
  const { word } = wordText({ word: result.word.id, pack: result.word.pack });

  useEffect(() => {
    if (result.kind === 'guessed') {
      haptics.success();
    } else if (result.kind === 'timeUp') {
      haptics.heavy();
    }
  }, [result.kind]);

  return (
    <View testID="croc.result" style={layout.root}>
      <AppText
        variant="h1"
        accessibilityRole="header"
        accessibilityLiveRegion="polite"
        style={layout.center}
      >
        {title(result)}
      </AppText>
      <AppText testID="croc.result.word" variant="h2" style={layout.center}>
        {t('camp.croc.wordWas', { word })}
      </AppText>
      {onNext ? (
        <AppButton
          testID="croc.next"
          label={t('camp.croc.next')}
          variant="secondary"
          onPress={() => {
            haptics.tap();
            onNext();
          }}
        />
      ) : null}
    </View>
  );
}

const layout = StyleSheet.create({
  root: { gap: spacing[16], paddingVertical: spacing[20] },
  center: { textAlign: 'center' },
});
