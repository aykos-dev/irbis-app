import { StyleSheet, View } from 'react-native';

import { AppText } from '../../../shared/components/AppText';
import { Icon } from '../../../shared/components/Icon';
import { spacing } from '../../../shared/constants/spacing';
import { useTheme } from '../../../shared/contexts/theme';
import { t } from '../../../shared/i18n';
import { useStreaks } from '../hooks/useStreaks';

/** Lessons hub line (AC7), only while the flame is at risk. */
export function StreakLessonsLine() {
  const { colors } = useTheme();
  const { signedIn, data } = useStreaks();
  if (!signedIn || !data?.flame.atRisk) {
    return null;
  }
  return (
    <View testID="lessons.streak-line" style={layout.row}>
      <Icon name="flame" color={colors.stone} />
      <AppText variant="body" style={layout.text}>
        {t('streaks.lessonsLine', { count: data.flame.count })}
      </AppText>
    </View>
  );
}

const layout = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[8] },
  text: { flex: 1 },
});
