import { StyleSheet, View } from 'react-native';

import type { PathWeatherDayDto } from '../../../shared/api/generated/model';
import { AppText } from '../../../shared/components/AppText';
import { weatherKind, WeatherGlyph } from '../../../shared/components/conditions/weatherGlyph';
import { conditionColors } from '../../../shared/constants/colors';
import { radii, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles } from '../../../shared/contexts/theme';
import { t } from '../../../shared/i18n';

/** Fri / Sat / Sun forecast pills (AC7) plus the Open-Meteo credit; hidden without days. */
export function WeatherStrip({ days }: { days: PathWeatherDayDto[] }) {
  const styles = useStyles();
  if (days.length === 0) {
    return null;
  }
  return (
    <View testID="path.weather" style={layout.root}>
      <View style={layout.row}>
        {days.map(day => {
          const storm = weatherKind(day.weatherCode) === 'storm';
          const label = t(`path.days.${day.day}`);
          const temp = `${Math.round(day.tMaxC)}°`;
          const wind = t('conditions.weather.wind', { kmh: Math.round(day.windKmh) });
          return (
            <View
              key={day.date}
              testID={`path.weather.${day.day}`}
              accessible
              accessibilityLabel={`${label}, ${temp}, ${wind}`}
              style={[styles.pill, storm ? layout.stormPill : null]}
            >
              <AppText variant="caption" style={storm ? layout.stormText : null}>
                {label}
              </AppText>
              <WeatherGlyph code={day.weatherCode} />
              <AppText variant="h3">{temp}</AppText>
              <AppText variant="small" style={storm ? layout.stormText : null}>
                {wind}
              </AppText>
            </View>
          );
        })}
      </View>
      <AppText variant="small">{t('path.weather.credit')}</AppText>
    </View>
  );
}

const layout = StyleSheet.create({
  root: { gap: spacing[8] },
  row: { flexDirection: 'row', gap: spacing[8] },
  stormPill: { backgroundColor: conditionColors.notNow.chipBg },
  stormText: { color: conditionColors.notNow.chipFg },
});

const useStyles = createThemedStyles(c => ({
  pill: {
    flex: 1,
    alignItems: 'center',
    gap: spacing[4],
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[4],
    borderRadius: radii.input,
    backgroundColor: c.soft,
  },
}));
