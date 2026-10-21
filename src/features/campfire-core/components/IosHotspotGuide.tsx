import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { iosHotspotGuide } from '../../../assets/images/campfire';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { Sheet } from '../../../shared/components/Sheet';
import { radii, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles } from '../../../shared/contexts/theme';
import { t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { qaLog } from '../../../shared/utils/qaLog';
import { campSizes } from '../campTheme';
import { campNet } from '../native/campNet';

type Props = {
  /** Personal Hotspot or Wi-Fi is on: open the lobby. */
  onReady: () => void;
  onDismiss: () => void;
};

const steps = ['camp.guide.step1', 'camp.guide.step2', 'camp.guide.step3'] as const;

/**
 * iPhone host guide (AC4): iOS can't start a hotspot, so the host turns on Personal Hotspot in
 * Settings and taps "It's on". No hotspot or Wi-Fi address yet → the sheet stays with a hint.
 */
export function IosHotspotGuide({ onReady, onDismiss }: Props) {
  const styles = useStyles();
  const [checking, setChecking] = useState(false);
  const [notOn, setNotOn] = useState(false);

  const check = async () => {
    setChecking(true);
    try {
      const address = await campNet.getIosHostAddress();
      if (address) {
        haptics.tap();
        onReady();
        return;
      }
      haptics.error();
      setNotOn(true);
    } catch (error) {
      qaLog('camp_ios_address_failed', {
        reason: error instanceof Error ? error.name : 'unknown',
      });
      haptics.error();
      setNotOn(true);
    } finally {
      setChecking(false);
    }
  };

  return (
    <Sheet
      testID="camp.ios-guide"
      accessibilityLabel={t('camp.guide.title')}
      onDismiss={onDismiss}
    >
      <AppText variant="h3" accessibilityRole="header">
        {t('camp.guide.title')}
      </AppText>
      <Image
        source={iosHotspotGuide}
        style={layout.picture}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        accessibilityIgnoresInvertColors
      />
      <View style={layout.steps}>
        {steps.map((key, index) => (
          <View key={key} style={layout.step}>
            <View style={[layout.number, styles.number]}>
              <AppText variant="chip" tone="white">
                {String(index + 1)}
              </AppText>
            </View>
            <AppText variant="body" style={layout.flex}>
              {t(key)}
            </AppText>
          </View>
        ))}
      </View>
      {notOn ? (
        <AppText
          testID="camp.ios-guide.not-on"
          variant="small"
          tone="red700"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          {t('camp.guide.notOn')}
        </AppText>
      ) : null}
      <AppButton
        testID="camp.ios-guide.done"
        label={t('camp.guide.done')}
        variant="primary"
        loading={checking}
        onPress={check}
      />
    </Sheet>
  );
}

const layout = StyleSheet.create({
  picture: { width: '100%', aspectRatio: campSizes.guideArtRatio, borderRadius: radii.card },
  steps: { gap: spacing[12] },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing[12] },
  number: {
    width: spacing[28],
    height: spacing[28],
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
});

const useStyles = createThemedStyles(c => ({
  number: { backgroundColor: c.teal700 },
}));
