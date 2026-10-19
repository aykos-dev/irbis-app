import { Image, StyleSheet, View } from 'react-native';

import { placeHeroes } from '../../../../assets/images/places';
import { AppText } from '../../../../shared/components/AppText';
import { spacing } from '../../../../shared/constants/spacing';
import { t } from '../../../../shared/i18n';
import { secretSizes } from '../../campTheme';

type Props = { word: string; category: string };

/** ImpReveal card content while held: the secret word over the lake art, with its category. */
export function WordSecret({ word, category }: Props) {
  return (
    <View testID="imp.word" style={layout.root}>
      <Image
        source={placeHeroes.lake}
        resizeMode="cover"
        style={layout.backdrop}
        accessibilityIgnoresInvertColors
        importantForAccessibility="no"
      />
      <AppText variant="caption" tone="muted">
        {t('camp.imp.yourWord')}
      </AppText>
      <AppText variant="h1" style={layout.center}>
        {word}
      </AppText>
      <AppText variant="small" tone="muted">
        {category}
      </AppText>
    </View>
  );
}

const layout = StyleSheet.create({
  root: { alignItems: 'center', gap: spacing[8], paddingVertical: spacing[20] },
  backdrop: { ...StyleSheet.absoluteFill, opacity: secretSizes.backdropOpacity },
  center: { textAlign: 'center' },
});
