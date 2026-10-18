import { StyleSheet, View } from 'react-native';

import type { WeekendDayDto } from '../../api/generated/model';
import { borders, radii, spacing } from '../../constants/spacing';
import { createThemedStyles } from '../../contexts/theme';
import { t } from '../../i18n';
import { AppText } from '../AppText';
import { WeatherGlyph } from './weatherGlyph';

/** Weekend weather (AC7): one row per day, then max wind and rain chance, then the credit. */
export function WeatherCard({ weekend }: { weekend: WeekendDayDto[] }) {
  const styles = useStyles();
  if (weekend.length === 0) {
    return null;
  }
  const wind = Math.round(Math.max(...weekend.map(day => day.windKmh)));
  const rain = Math.round(Math.max(...weekend.map(day => day.precipProbPct)));
  const summary = `${t('conditions.weather.wind', { kmh: wind })} · ${t('conditions.weather.rain', { pct: rain })}`;

  return (
    <View testID="place.weather" style={[styles.card, layout.gap]}>
      <AppText variant="h3" accessibilityRole="header">
        {t('conditions.weather.title')}
      </AppText>
      {weekend.map(day => {
        const line = t('conditions.weather.temps', {
          day: t(`conditions.dayShort.${day.day}`),
          max: Math.round(day.tMaxC),
          min: Math.round(day.tMinC),
        });
        return (
          <View
            key={day.date}
            testID={`place.weather-day.${day.day}`}
            style={layout.row}
            accessible
            accessibilityLabel={line}
          >
            <WeatherGlyph code={day.weatherCode} testID={`place.weather-glyph.${day.day}`} />
            <AppText variant="body">{line}</AppText>
          </View>
        );
      })}
      <AppText testID="place.weather-summary" variant="small">
        {summary}
      </AppText>
      <AppText variant="caption">{t('conditions.weather.credit')}</AppText>
    </View>
  );
}

const layout = StyleSheet.create({
  gap: { gap: spacing[10] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[12] },
});

const useStyles = createThemedStyles(c => ({
  card: {
    padding: spacing[16],
    borderRadius: radii.card,
    borderWidth: borders.card,
    borderColor: c.line,
    backgroundColor: c.card,
  },
}));
