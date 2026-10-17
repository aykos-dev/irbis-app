import { StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { bootSvg } from '../../../assets/svg/boot';
import { AppText } from '../../../shared/components/AppText';
import { difficultyBootColor } from '../../../shared/constants/colors';
import { spacing } from '../../../shared/constants/spacing';
import { useTheme } from '../../../shared/contexts/theme';
import { t } from '../../../shared/i18n';

const BOOTS_MAX = 5;
const BOOT = 20;

/** "Difficulty d/5" with five boots, d filled (AC7). */
export function DifficultyBoots({ difficulty }: { difficulty: number }) {
  const { colors } = useTheme();
  const label = t('places.difficulty', { d: difficulty });
  return (
    <View testID="place.difficulty" accessible accessibilityLabel={label} style={styles.row}>
      <AppText variant="h3">{label}</AppText>
      <View style={styles.boots}>
        {Array.from({ length: BOOTS_MAX }, (_, index) => (
          <SvgXml
            key={index}
            xml={bootSvg}
            width={BOOT}
            height={BOOT}
            color={index < difficulty ? difficultyBootColor : colors.line}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[12] },
  boots: { flexDirection: 'row', gap: spacing[4] },
});
