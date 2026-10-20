import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { AppText } from '../../../shared/components/AppText';
import { Mascot } from '../../../shared/components/Mascot';
import { borders, radii, spacing } from '../../../shared/constants/spacing';
import { fontFamily } from '../../../shared/constants/typography';
import { createThemedStyles, useTheme } from '../../../shared/contexts/theme';
import { t } from '../../../shared/i18n';
import { goalRingColors } from '../lessonColors';

const RING = 72;
const RADIUS = 32;
const STROKE = 9;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const COUNT_SIZE = 19;
const MASCOT = 60;

type Props = { done: number; target: number };

/** Daily goal card (AC4): ring with "n/target", the line, Irbis on the right. */
export function GoalRing({ done, target }: Props) {
  const { scheme } = useTheme();
  const styles = useStyles();
  const ring = goalRingColors[scheme];
  const fraction = target > 0 ? Math.min(done / target, 1) : 1;
  const left = Math.max(target - done, 0);
  const line = left > 0 ? t('lessons.goal.more', { count: left }) : t('lessons.goal.done');

  return (
    <View testID="lessons.goal" style={styles.card} accessible accessibilityLabel={`${t('lessons.goal.title')}. ${done}/${target}. ${line}`}>
      <View style={layout.ring}>
        <Svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`}>
          <Circle cx={RING / 2} cy={RING / 2} r={RADIUS} stroke={ring.track} strokeWidth={STROKE} fill="none" />
          {fraction > 0 ? (
            <Circle
              cx={RING / 2}
              cy={RING / 2}
              r={RADIUS}
              stroke={ring.progress}
              strokeWidth={STROKE}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${CIRCUMFERENCE * fraction} ${CIRCUMFERENCE}`}
              transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
            />
          ) : null}
        </Svg>
        <View style={layout.count}>
          <AppText variant="h3" tone="ink" style={layout.countText}>
            {`${done}/${target}`}
          </AppText>
        </View>
      </View>
      <View style={layout.text}>
        <AppText variant="h3" tone="ink" style={layout.title}>
          {t('lessons.goal.title')}
        </AppText>
        <AppText variant="small" tone="muted">
          {line}
        </AppText>
      </View>
      <Mascot kind="default" size={MASCOT} />
    </View>
  );
}

const layout = StyleSheet.create({
  ring: { width: RING, height: RING },
  count: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  countText: { fontFamily: fontFamily.black, fontSize: COUNT_SIZE, lineHeight: COUNT_SIZE + spacing[4] },
  text: { flex: 1, gap: spacing[4] },
  title: { fontFamily: fontFamily.black },
});

const useStyles = createThemedStyles(c => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[14],
    padding: spacing[14],
    borderRadius: radii.card,
    borderWidth: borders.card,
    borderBottomWidth: borders.edge,
    borderColor: c.line,
    backgroundColor: c.card,
  },
}));
