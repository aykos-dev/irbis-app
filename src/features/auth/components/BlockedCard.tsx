import { StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn } from 'react-native-reanimated';

import { AppText } from '../../../shared/components/AppText';
import { conditionColors } from '../../../shared/constants/colors';
import { borders, motion, radii, spacing } from '../../../shared/constants/spacing';
import { t } from '../../../shared/i18n';

const entering = FadeIn.duration(motion.enter).easing(Easing.out(Easing.cubic));
const knownReasons = ['spam', 'harassment', 'unsafe', 'fake_content', 'other'];

/** A1 error state: "Your account is blocked" with the reason category (AC11). */
export function BlockedCard({ reasonCode }: { reasonCode: string | null }) {
  const reason = reasonCode && knownReasons.includes(reasonCode) ? reasonCode : null;
  return (
    <Animated.View
      entering={entering}
      testID="auth.blocked"
      accessible
      accessibilityRole="alert"
      style={styles.card}
    >
      <View style={styles.text}>
        <AppText variant="h3" style={styles.ink}>
          {t('auth.blocked.title')}
        </AppText>
        {reason ? (
          <AppText variant="small" testID="auth.blocked-reason" style={styles.ink}>
            {t('auth.blocked.reason', { reason: t(`auth.blocked.reasons.${reason}`) })}
          </AppText>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.tile,
    borderWidth: borders.card,
    borderColor: conditionColors.notNow.ring,
    backgroundColor: conditionColors.notNow.chipBg,
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[16],
  },
  text: { gap: spacing[4] },
  ink: { color: conditionColors.notNow.chipFg },
});
