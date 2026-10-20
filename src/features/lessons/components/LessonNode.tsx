import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import type { LessonIcon } from '../../../shared/api/generated/model';
import { AppText } from '../../../shared/components/AppText';
import { Pressable } from '../../../shared/components/Pressable';
import { palette, shadowColor } from '../../../shared/constants/colors';
import { elevation, radii, spacing } from '../../../shared/constants/spacing';
import { fontFamily } from '../../../shared/constants/typography';
import { useTheme } from '../../../shared/contexts/theme';
import { t } from '../../../shared/i18n';
import { doneRingColor, glyphColors } from '../lessonColors';
import { LessonGlyph } from './LessonGlyph';

const NODE = 84;
const RING_R = 38;
const RING_STROKE = 6;
const INNER = 60;
const INNER_INSET = 12;
const GLYPH = 30;
const START_OFFSET = -10;
const START_SIZE = 11;
const START_LETTER_EM = 0.06;

type Props = {
  id: string;
  title: string;
  icon: LessonIcon;
  done: boolean;
  start: boolean;
  onPress: () => void;
};

/** One lesson in a tier grid (AC4): progress ring (gold when done), glyph circle, title, START pill. */
export function LessonNode({ id, title, icon, done, start, onPress }: Props) {
  const { colors } = useTheme();
  const label = start ? `${t('lessons.node.start')}: ${title}` : title;
  return (
    <Pressable
      testID={`lessons.lesson.${id}`}
      accessibilityLabel={label}
      accessibilityState={{ checked: done }}
      onPress={onPress}
      style={styles.root}
    >
      <View style={styles.node}>
        <Svg width={NODE} height={NODE} style={StyleSheet.absoluteFill}>
          <Circle
            cx={NODE / 2}
            cy={NODE / 2}
            r={RING_R}
            stroke={done ? doneRingColor : colors.line}
            strokeWidth={RING_STROKE}
            fill="none"
          />
        </Svg>
        <View style={[styles.inner, { backgroundColor: glyphColors[icon] }]}>
          <LessonGlyph icon={icon} color={palette.white} size={GLYPH} />
        </View>
        {start ? (
          <View testID="lessons.start" style={styles.start}>
            <AppText variant="caption" tone="white" style={styles.startText}>
              {t('lessons.node.start')}
            </AppText>
          </View>
        ) : null}
      </View>
      <AppText variant="h3" tone="ink" style={styles.title}>
        {title}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', gap: spacing[6] },
  node: { width: NODE, height: NODE },
  inner: {
    position: 'absolute',
    top: INNER_INSET,
    left: INNER_INSET,
    width: INNER,
    height: INNER,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor,
    shadowOffset: { width: 0, height: spacing[4] },
    shadowOpacity: elevation.node.opacity,
    shadowRadius: 0,
    elevation: elevation.node.androidElevation,
  },
  start: {
    position: 'absolute',
    top: START_OFFSET,
    alignSelf: 'center',
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[4] / 2,
    borderRadius: radii.pill,
    backgroundColor: palette.teal700,
  },
  startText: { fontFamily: fontFamily.black, fontSize: START_SIZE, letterSpacing: START_SIZE * START_LETTER_EM },
  title: { textAlign: 'center' },
});
