import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AppText } from '../../../shared/components/AppText';
import { Icon } from '../../../shared/components/Icon';
import { Pressable } from '../../../shared/components/Pressable';
import { radii, sizes, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles, useTheme } from '../../../shared/contexts/theme';
import { t } from '../../../shared/i18n';

/** Steps with a header: Language, Experience, Interests (Companion has none). */
export const ONBOARDING_STEPS = 4;

const ICON = 26;
const BAR_HEIGHT = 12;

type Props = {
  /** 1-based: Language 1, Experience 2, Interests 3. */
  step: number;
  onBack: () => void;
  onClose: () => void;
};

/** Steps 2–4: back chevron, progress bar with "Step N of 4", ✕. */
export function OnboardingHeader({ step, onBack, onClose }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const label = t('onboarding.header.progress', { n: step });

  return (
    <View style={layout.row}>
      <Pressable
        testID="onboarding.back"
        accessibilityLabel={t('onboarding.header.back')}
        onPress={onBack}
        style={layout.button}
      >
        <Icon name="back" color={colors.stone} size={ICON} />
      </Pressable>
      <View
        testID="onboarding.progress"
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: ONBOARDING_STEPS, now: step }}
        style={layout.progress}
      >
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${(step / ONBOARDING_STEPS) * 100}%` }]} />
        </View>
        <AppText variant="caption">{label}</AppText>
      </View>
      <Pressable
        testID="onboarding.close"
        accessibilityLabel={t('onboarding.header.close')}
        onPress={onClose}
        style={layout.button}
      >
        <Svg
          viewBox="0 0 24 24"
          width={ICON}
          height={ICON}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Path
            d="M6 6l12 12M18 6L6 18"
            fill="none"
            stroke={colors.stone}
            strokeWidth={3}
            strokeLinecap="round"
          />
        </Svg>
      </Pressable>
    </View>
  );
}

const layout = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[8] },
  button: {
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progress: { flex: 1, gap: spacing[4] },
});

const useStyles = createThemedStyles(c => ({
  track: { height: BAR_HEIGHT, borderRadius: radii.pill, backgroundColor: c.line, overflow: 'hidden' },
  fill: { height: BAR_HEIGHT, borderRadius: radii.pill, backgroundColor: c.teal },
}));
