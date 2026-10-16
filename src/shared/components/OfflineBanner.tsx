import { StyleSheet } from 'react-native';
import Animated, { Easing, FadeInUp, FadeOutUp } from 'react-native-reanimated';

import { conditionColors } from '../constants/colors';
import { motion, radii, spacing } from '../constants/spacing';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { t } from '../i18n';
import { AppText } from './AppText';

const entering = FadeInUp.duration(motion.enter).easing(Easing.out(Easing.cubic));
const exiting = FadeOutUp.duration(motion.exit).easing(Easing.in(Easing.cubic));

/** Persistent offline notice — a banner, never a toast (engineering-standards §11). */
export function OfflineBanner() {
  const { isOnline } = useNetworkStatus();
  if (isOnline) {
    return null;
  }
  return (
    <Animated.View
      testID="app.offline-banner"
      entering={entering}
      exiting={exiting}
      style={styles.banner}
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <AppText variant="small" style={styles.text}>
        {t('common.offline')}
      </AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: conditionColors.caution.chipBg,
    borderRadius: radii.tile,
    paddingVertical: spacing[10],
    paddingHorizontal: spacing[14],
  },
  text: {
    color: conditionColors.caution.chipFg,
  },
});
