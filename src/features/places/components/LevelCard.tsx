import { StyleSheet, View } from 'react-native';

import { AppText } from '../../../shared/components/AppText';
import { Icon } from '../../../shared/components/Icon';
import { conditionColors, levelColors, palette } from '../../../shared/constants/colors';
import { borders, radii, sizes, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles, useTheme } from '../../../shared/contexts/theme';
import { t } from '../../../shared/i18n';

type Props = {
  requiredLevel: number;
  qualifies: boolean;
};

type LevelKey = keyof typeof levelColors;

function levelKey(level: number): LevelKey {
  const keys = Object.keys(levelColors).map(Number);
  const max = Math.max(...keys);
  return Math.min(Math.max(level, 1), max) as LevelKey;
}

/**
 * Required level (AC8): "Requires · Level n · name · or higher", then "You qualify" with a green
 * check, or a lock with "Reach Level n to go here". Read-only — never optimistic.
 */
export function LevelCard({ requiredLevel, qualifies }: Props) {
  const { colors, scheme } = useTheme();
  const styles = useStyles();
  const tone = levelColors[levelKey(requiredLevel)];
  const lineColor = { color: scheme === 'dark' ? tone.color : tone.text };
  const line = t('places.level.line', {
    n: requiredLevel,
    name: t(`places.levels.${requiredLevel}`),
  });

  return (
    <View testID="place.level-card" style={[styles.card, { borderColor: tone.color }]}>
      <View style={[layout.badge, { backgroundColor: qualifies ? tone.color : colors.soft }]}>
        {qualifies ? (
          <AppText variant="h3" tone="white">
            {requiredLevel}
          </AppText>
        ) : (
          <Icon name="lock" color={colors.muted} />
        )}
      </View>
      <View style={layout.text}>
        <AppText variant="caption">{t('places.level.requires')}</AppText>
        <AppText variant="h3" style={lineColor}>
          {line}
        </AppText>
        <AppText variant="small">{t('places.level.orHigher')}</AppText>
        {qualifies ? (
          <View testID="place.level-qualify" style={layout.status}>
            <Icon name="checkCircle" color={conditionColors.go.ring} accent={palette.white} />
            <AppText variant="small" tone="ink">
              {t('places.level.qualify')}
            </AppText>
          </View>
        ) : (
          <View testID="place.level-locked" style={layout.status}>
            <Icon name="lock" color={colors.muted} />
            <AppText variant="small" style={layout.statusText}>
              {t('places.level.locked', { n: requiredLevel })}
            </AppText>
          </View>
        )}
      </View>
    </View>
  );
}

const layout = StyleSheet.create({
  badge: {
    width: sizes.placeTypeDot,
    height: sizes.placeTypeDot,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: spacing[4] },
  status: { flexDirection: 'row', alignItems: 'center', gap: spacing[6], paddingTop: spacing[4] },
  /** Lets long translations (uz) wrap inside the card instead of overflowing it (D3). */
  statusText: { flexShrink: 1 },
});

const useStyles = createThemedStyles(c => ({
  card: {
    flexDirection: 'row',
    gap: spacing[12],
    padding: spacing[16],
    borderRadius: radii.card,
    borderWidth: borders.card,
    borderBottomWidth: borders.edge,
    backgroundColor: c.card,
  },
}));
