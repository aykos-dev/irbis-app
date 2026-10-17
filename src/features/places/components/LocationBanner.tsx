import { StyleSheet, View } from 'react-native';

import { AppText } from '../../../shared/components/AppText';
import { Pressable } from '../../../shared/components/Pressable';
import { borders, radii, sizes, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles } from '../../../shared/contexts/theme';
import { t } from '../../../shared/i18n';

/** Shown while distances come from Tashkent (AC6): "Turn on" asks again or opens settings. */
export function LocationBanner({ onTurnOn }: { onTurnOn: () => void }) {
  const styles = useStyles();
  return (
    <View testID="explore.location-banner" style={styles.banner}>
      <AppText variant="small" style={layout.text}>
        {t('places.location.banner')}
      </AppText>
      <Pressable
        testID="explore.location-turn-on"
        accessibilityRole="button"
        accessibilityLabel={t('places.location.turnOn')}
        onPress={onTurnOn}
        style={layout.action}
      >
        <AppText variant="chip" tone="teal700">
          {t('places.location.turnOn')}
        </AppText>
      </Pressable>
    </View>
  );
}

const layout = StyleSheet.create({
  text: { flex: 1 },
  action: { minHeight: sizes.touchTarget, justifyContent: 'center', paddingHorizontal: spacing[8] },
});

const useStyles = createThemedStyles(c => ({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    paddingStart: spacing[14],
    paddingEnd: spacing[6],
    borderRadius: radii.tile,
    borderWidth: borders.card,
    borderColor: c.line,
    backgroundColor: c.card,
  },
}));
