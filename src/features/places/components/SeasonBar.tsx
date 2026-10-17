import { StyleSheet, View } from 'react-native';

import type { SeasonStatus } from '../../../shared/api/generated/model';
import { AppText } from '../../../shared/components/AppText';
import { conditionColors } from '../../../shared/constants/colors';
import { borders, radii, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles } from '../../../shared/contexts/theme';
import { t } from '../../../shared/i18n';

const MONTHS = 12;
const TIME_ZONE = 'Asia/Tashkent';
const CELL_HEIGHT = 32;
const LEGEND_DOT = 10;

const statusColor: Record<SeasonStatus, string> = {
  best: conditionColors.go.ring,
  possible: conditionColors.caution.ring,
  closed: conditionColors.seasonalLock.ring,
};

const statuses: SeasonStatus[] = ['best', 'possible', 'closed'];

/** 0-based month of `now` in Tashkent. */
export function tashkentMonth(now: Date): number {
  const month = new Intl.DateTimeFormat('en-US', { month: 'numeric', timeZone: TIME_ZONE }).format(now);
  return Number(month) - 1;
}

function monthName(now: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', timeZone: TIME_ZONE }).format(now);
}

type Props = {
  season: SeasonStatus[];
  locale: string;
  now?: Date;
};

/** Twelve months (AC7): initials, today's month outlined, legend. Empty copy unless 12 entries. */
export function SeasonBar({ season, locale, now = new Date() }: Props) {
  const styles = useStyles();

  if (season.length !== MONTHS) {
    return (
      <AppText testID="place.season-empty" variant="body" tone="muted">
        {t('places.season.empty')}
      </AppText>
    );
  }

  const initials = t('places.season.months').split(' ');
  const today = tashkentMonth(now);
  const todayName = monthName(now, locale);

  return (
    <View testID="place.season" style={layout.root}>
      <View style={layout.cells}>
        {season.map((status, index) => (
          <View
            key={index}
            testID={`place.season-${index + 1}`}
            accessible
            accessibilityLabel={`${initials[index] ?? ''} ${t(`places.season.${status}`)}`}
            style={[
              layout.cell,
              { backgroundColor: statusColor[status] },
              index === today && styles.today,
            ]}
          >
            <AppText variant="small" tone="white">
              {initials[index]}
            </AppText>
          </View>
        ))}
      </View>
      <AppText testID="place.season-today" variant="small">
        {t('places.season.today', { month: todayName })}
      </AppText>
      <View style={layout.legend}>
        {statuses.map(status => (
          <View key={status} style={layout.legendItem}>
            <View style={[layout.dot, { backgroundColor: statusColor[status] }]} />
            <AppText variant="small">{t(`places.season.${status}`)}</AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

const layout = StyleSheet.create({
  root: { gap: spacing[8] },
  cells: { flexDirection: 'row', gap: spacing[4] },
  cell: {
    flex: 1,
    height: CELL_HEIGHT,
    borderRadius: radii.checkbox,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[12] },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing[6] },
  dot: { width: LEGEND_DOT, height: LEGEND_DOT, borderRadius: radii.pill },
});

const useStyles = createThemedStyles(c => ({
  today: { borderWidth: borders.card, borderColor: c.ink },
}));
