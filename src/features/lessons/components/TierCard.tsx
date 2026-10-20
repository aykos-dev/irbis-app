import { StyleSheet, View } from 'react-native';

import type { CatalogLesson, CatalogTier } from '../../../shared/api/generated/model';
import { AppText } from '../../../shared/components/AppText';
import { Icon } from '../../../shared/components/Icon';
import { palette } from '../../../shared/constants/colors';
import { borders, radii, sizes, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles } from '../../../shared/contexts/theme';
import { t, type Locale } from '../../../shared/i18n';
import { tierTint } from '../lessonColors';
import { LessonGlyph } from './LessonGlyph';
import { LessonNode } from './LessonNode';

const COLUMNS = 3;
const TILE = 40;
const TILE_RADIUS = 12;
const TILE_GLYPH = 24;
const CARD_RADIUS = 22;
const PILL_CHECK = 14;

/** "Tier N" for keys 1–5 (and any other key), "First aid" for `first-aid`. */
export function tierCaption(key: string): string {
  return key === 'first-aid' ? t('lessons.tier.firstAid') : t('lessons.tier.caption', { n: key });
}

function rows<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += COLUMNS) {
    out.push(items.slice(i, i + COLUMNS));
  }
  return out;
}

type Props = {
  tier: CatalogTier;
  locale: Locale;
  done: ReadonlySet<string>;
  startId: string | undefined;
  onOpen: (lesson: CatalogLesson) => void;
};

/** One tier (AC4): tinted header with caption, title and the done pill, then a 3-column lesson grid. */
export function TierCard({ tier, locale, done, startId, onOpen }: Props) {
  const styles = useStyles();
  const lessons = [...tier.lessons].sort((a, b) => a.order - b.order);
  const doneCount = lessons.filter(lesson => done.has(lesson.id)).length;
  const allDone = lessons.length > 0 && doneCount === lessons.length;
  const first = lessons[0];

  return (
    <View testID={`lessons.tier.${tier.key}`} style={styles.card}>
      <View style={[layout.header, { backgroundColor: tierTint(tier.colour) }]}>
        <View style={[layout.tile, { backgroundColor: tier.colour }]}>
          {first ? <LessonGlyph icon={first.icon} color={palette.white} size={TILE_GLYPH} /> : null}
        </View>
        <View style={layout.headText}>
          <AppText variant="caption">{tierCaption(tier.key)}</AppText>
          <AppText variant="h2" accessibilityRole="header">
            {tier.title[locale]}
          </AppText>
        </View>
        <View style={styles.pill}>
          {allDone ? (
            <>
              <Icon name="check" color={palette.teal700} size={PILL_CHECK} />
              <AppText variant="caption" tone="teal700">
                {t('lessons.tier.done')}
              </AppText>
            </>
          ) : (
            <AppText variant="caption" tone="ink">{`${doneCount} / ${lessons.length}`}</AppText>
          )}
        </View>
      </View>
      <View style={layout.grid}>
        {rows(lessons).map(row => (
          <View key={row[0]?.id} style={layout.row}>
            {row.map(lesson => (
              <LessonNode
                key={lesson.id}
                id={lesson.id}
                title={lesson.title[locale]}
                icon={lesson.icon}
                done={done.has(lesson.id)}
                start={lesson.id === startId}
                onPress={() => onOpen(lesson)}
              />
            ))}
            {Array.from({ length: COLUMNS - row.length }, (_, i) => (
              <View key={`gap-${i}`} style={layout.filler} />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const layout = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[14],
  },
  tile: { width: TILE, height: TILE, borderRadius: TILE_RADIUS, alignItems: 'center', justifyContent: 'center' },
  headText: { flex: 1 },
  grid: { gap: spacing[16], paddingTop: spacing[14], paddingHorizontal: spacing[10], paddingBottom: spacing[16] },
  row: { flexDirection: 'row', gap: spacing[8] },
  filler: { flex: 1 },
});

const useStyles = createThemedStyles(c => ({
  card: {
    borderRadius: CARD_RADIUS,
    borderWidth: borders.card,
    borderBottomWidth: borders.edge,
    borderColor: c.line,
    backgroundColor: c.card,
    overflow: 'hidden',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    height: sizes.chipHeight,
    paddingHorizontal: spacing[10],
    borderRadius: radii.pill,
    backgroundColor: c.card,
  },
}));
