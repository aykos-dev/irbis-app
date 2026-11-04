import { StyleSheet, View } from 'react-native';

import { AppText } from '../../../shared/components/AppText';
import { Icon } from '../../../shared/components/Icon';
import { streakColors } from '../../../shared/constants/colors';
import { borders, radii, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles } from '../../../shared/contexts/theme';
import { t } from '../../../shared/i18n';
import { useStreaks } from '../hooks/useStreaks';

const GLYPH = 24;

/** Summit "{n} Week streak" tile (AC7): the boot count once the post-check-in refetch lands. */
export function WeekStreakTile() {
  const styles = useStyles();
  const { signedIn, data, isFetching } = useStreaks();
  if (!signedIn || !data || isFetching) {
    return null;
  }
  const label = t('streaks.summit', { count: data.boot.count });
  return (
    <View testID="summit.week-streak" style={styles.tile} accessible accessibilityLabel={label}>
      <Icon name="boot" color={streakColors.boot} size={GLYPH} />
      <AppText variant="h3">{label}</AppText>
    </View>
  );
}

const layout = StyleSheet.create({
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[8],
    padding: spacing[16],
    borderRadius: radii.card,
    borderWidth: borders.card,
  },
});

const useStyles = createThemedStyles(c => ({
  tile: {
    ...layout.tile,
    borderColor: c.line,
    backgroundColor: c.card,
  },
}));
