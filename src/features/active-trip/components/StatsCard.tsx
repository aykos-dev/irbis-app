import { Linking, StyleSheet, View } from 'react-native';

import type { TripDto } from '../../../shared/api/generated/model';
import { AppText, type TextTone } from '../../../shared/components/AppText';
import { Pressable } from '../../../shared/components/Pressable';
import { borders, radii, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles } from '../../../shared/contexts/theme';
import { t, type Locale } from '../../../shared/i18n';
import type { LocationPermission } from '../hooks/useTripTracking';
import type { Track } from '../trackStore';
import { formatClock, formatDuration, formatKm, formatMetres } from '../tripFormat';

type Props = {
  trip: TripDto;
  track: Track;
  permission: LocationPermission;
  now: number;
  locale: Locale;
};

type Status = { key: string; tone: TextTone };

/** Status line (AC1): alerted wins, then late once past back-by, otherwise on track. */
function tripStatus(trip: TripDto, now: number): Status {
  if (trip.status === 'alerted') {
    return { key: 'active.status.alerted', tone: 'red700' };
  }
  if (now > Date.parse(trip.backBy)) {
    return { key: 'active.status.late', tone: 'red700' };
  }
  return { key: 'active.status.onTrack', tone: 'teal700' };
}

/** Top card (AC1, AC2): status, back-by and the live stats; location off or no fix yet says so. */
export function StatsCard({ trip, track, permission, now, locale }: Props) {
  const styles = useStyles();
  const status = tripStatus(trip, now);
  const denied = permission === 'denied';
  const none = t('active.stat.none');
  const distance = denied ? none : formatKm(track.distanceM, locale);
  const climb = denied ? none : `+${formatMetres(track.climbM, locale)}`;
  const elapsed = trip.startedAt ? formatDuration(now - Date.parse(trip.startedAt)) : none;

  return (
    <View style={[styles.card, layout.card]}>
      <View style={layout.head}>
        <AppText testID="active.status" variant="caption" tone={status.tone} accessibilityRole="header">
          {t(status.key)}
        </AppText>
        <AppText testID="active.backby" variant="small">
          {t('active.backBy', { time: formatClock(new Date(trip.backBy), locale) })}
        </AppText>
      </View>
      <View style={layout.stats}>
        <Stat testID="active.distance" value={distance} label={t('active.stat.km')} />
        <Stat testID="active.climb" value={climb} label={t('active.stat.climb')} />
        <Stat testID="active.elapsed" value={elapsed} label={t('active.stat.elapsed')} />
      </View>
      {denied ? (
        <View testID="active.location-off" style={layout.row} accessibilityRole="alert">
          <AppText variant="small" style={layout.fill}>
            {t('active.locationOff')}
          </AppText>
          <Pressable
            testID="active.location-off.settings"
            accessibilityRole="button"
            accessibilityLabel={t('active.locationOffCta')}
            onPress={() => void Linking.openSettings()}
          >
            <AppText variant="button" tone="teal700">
              {t('active.locationOffCta')}
            </AppText>
          </Pressable>
        </View>
      ) : null}
      {permission === 'granted' && !track.last ? (
        <AppText testID="active.finding" variant="small" accessibilityLiveRegion="polite">
          {t('active.findingYou')}
        </AppText>
      ) : null}
    </View>
  );
}

function Stat({ testID, value, label }: { testID: string; value: string; label: string }) {
  return (
    <View style={layout.stat} accessible accessibilityLabel={`${value} ${label}`}>
      <AppText testID={testID} variant="stat">
        {value}
      </AppText>
      <AppText variant="caption">{label}</AppText>
    </View>
  );
}

const layout = StyleSheet.create({
  card: { padding: spacing[16], gap: spacing[12] },
  head: { gap: spacing[4] },
  stats: { flexDirection: 'row', gap: spacing[12] },
  stat: { flex: 1, gap: spacing[4] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[8] },
  fill: { flex: 1 },
});

const useStyles = createThemedStyles(c => ({
  card: {
    borderRadius: radii.card,
    borderWidth: borders.card,
    borderColor: c.line,
    backgroundColor: c.card,
  },
}));
