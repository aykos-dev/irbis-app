import { StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn } from 'react-native-reanimated';

import { errorMessageKey } from '../api/errors';
import { motion, spacing } from '../constants/spacing';
import { t } from '../i18n';
import { AppButton } from './AppButton';
import { AppText } from './AppText';

type Props = {
  /** The failure; mapped to a plain-language message by its code, never shown raw. */
  error: unknown;
  onRetry: () => void;
  testID: string;
  retryTestID: string;
  title?: string;
};

const entering = FadeIn.duration(motion.enter).easing(Easing.out(Easing.cubic));

/** Error state with Retry wired to `refetch` (engineering-standards §11). */
export function ErrorState({ error, onRetry, testID, retryTestID, title }: Props) {
  return (
    <Animated.View testID={testID} entering={entering} style={styles.root}>
      <View style={styles.text} accessible accessibilityRole="alert">
        {title ? <AppText variant="h3">{title}</AppText> : null}
        <AppText variant="body">{t(errorMessageKey(error))}</AppText>
      </View>
      <AppButton testID={retryTestID} label={t('common.retry')} variant="white" onPress={onRetry} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing[16],
  },
  text: {
    gap: spacing[6],
  },
});
