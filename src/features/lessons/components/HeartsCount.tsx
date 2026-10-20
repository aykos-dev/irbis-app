import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AppText } from '../../../shared/components/AppText';
import { spacing } from '../../../shared/constants/spacing';
import { fontFamily } from '../../../shared/constants/typography';
import { t } from '../../../shared/i18n';
import { heartColor } from '../lessonColors';

const HEART = 24;
const COUNT_SIZE = 16;
const HEART_PATH = 'M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z';

/** Heart + today's count (hub header, AC6). */
export function HeartsCount({ hearts }: { hearts: number }) {
  return (
    <View
      testID="lessons.hearts"
      style={styles.row}
      accessible
      accessibilityLabel={t('lessons.hub.heartsA11y', { count: hearts })}
    >
      <Svg viewBox="0 0 24 24" width={HEART} height={HEART}>
        <Path d={HEART_PATH} fill={heartColor} />
      </Svg>
      <AppText variant="h3" tone="ink" style={styles.count}>
        {hearts}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  count: { fontFamily: fontFamily.black, fontSize: COUNT_SIZE, lineHeight: HEART },
});
