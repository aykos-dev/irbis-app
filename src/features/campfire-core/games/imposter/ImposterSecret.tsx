import { StyleSheet, View } from 'react-native';

import { AppButton } from '../../../../shared/components/AppButton';
import { AppText } from '../../../../shared/components/AppText';
import { spacing } from '../../../../shared/constants/spacing';
import { t } from '../../../../shared/i18n';

type Props = {
  /** Pack name when the host lets the imposter see it, else null. */
  category: string | null;
};

/** ImpImposter card content while held: "SHH…", the role and the category (if allowed). */
export function ImposterSecret({ category }: Props) {
  return (
    <View testID="imp.imposter" style={layout.root}>
      <AppText variant="caption" tone="muted">
        {t('camp.imp.shh')}
      </AppText>
      <AppText variant="h1" style={layout.center}>
        {t('camp.imp.youAre')}
      </AppText>
      <AppText variant="body" style={layout.center}>
        {t(category ? 'camp.imp.noWord' : 'camp.imp.noWordOnly')}
      </AppText>
      {category ? (
        <AppText variant="h3" style={layout.center}>
          {category}
        </AppText>
      ) : null}
    </View>
  );
}

type ExplainerProps = Props & { onGotIt: () => void };

/** After the imposter first lets go of the card: the role again plus how to win; Got it covers it. */
export function ImposterExplainer({ category, onGotIt }: ExplainerProps) {
  return (
    <View style={layout.explainer}>
      <ImposterSecret category={category} />
      <AppText variant="h3" accessibilityRole="header">
        {t('camp.imp.howToWin')}
      </AppText>
      <AppText variant="body">{t('camp.imp.win1')}</AppText>
      <AppText variant="body">{t('camp.imp.win2')}</AppText>
      <AppButton testID="imp.got-it" label={t('camp.imp.gotIt')} onPress={onGotIt} />
    </View>
  );
}

const layout = StyleSheet.create({
  root: { alignItems: 'center', gap: spacing[8], paddingVertical: spacing[20] },
  explainer: { gap: spacing[12] },
  center: { textAlign: 'center' },
});
