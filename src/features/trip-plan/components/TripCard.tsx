import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { TripDto, TripPlaceDto } from '../../../shared/api/generated/model';
import { useGetCurrentTrips } from '../../../shared/api/generated/trips/trips';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { ErrorState } from '../../../shared/components/ErrorState';
import { Pressable } from '../../../shared/components/Pressable';
import { Sheet } from '../../../shared/components/Sheet';
import { borders, radii, spacing } from '../../../shared/constants/spacing';
import { useAuth } from '../../../shared/contexts/auth';
import { createThemedStyles } from '../../../shared/contexts/theme';
import { useLocale } from '../../../shared/hooks/useLocale';
import { useNetworkStatus } from '../../../shared/hooks/useNetworkStatus';
import { t, type Locale } from '../../../shared/i18n';
import { useTripCardActions } from '../hooks/useTripCardActions';
import { formatClock, formatDay, tashkentDay } from '../tripTimes';
import { BackByPicker } from './BackByPicker';

function placeName(place: TripPlaceDto, locale: Locale): string {
  const names: Record<Locale, string | null> = { uz: place.nameUz, ru: place.nameRu, en: place.nameEn };
  return names[locale] ?? place.nameUz;
}

/**
 * Home trip card (AC7): the active trip (check out, change back-by, alerted line) and the planned
 * ones (start, edit, delete). Signed-in only; nothing to show → not rendered. Offline keeps the
 * cached trips with every button disabled.
 */
export function TripCard() {
  const { status } = useAuth();
  const signedIn = status === 'signedIn';
  const query = useGetCurrentTrips({ query: { enabled: signedIn } });
  const navigation = useNavigation();
  const locale = useLocale();
  const { isOnline } = useNetworkStatus();
  const styles = useStyles();
  const actions = useTripCardActions();
  const [deleting, setDeleting] = useState<{ trip: TripDto; closing: boolean } | null>(null);

  if (!signedIn) {
    return null;
  }
  const { data } = query;
  if (!data) {
    return query.error ? (
      <ErrorState
        testID="home.trip-card.error"
        retryTestID="home.trip-card.retry"
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    ) : null;
  }
  const { active, planned } = data;
  if (!active && planned.length === 0) {
    return null;
  }
  const disabled = !isOnline || actions.pending;

  return (
    <View testID="home.trip-card" style={[styles.card, layout.card]}>
      {active ? (
        <View style={layout.section}>
          <Pressable
            testID="home.trip.open"
            accessibilityRole="button"
            accessibilityLabel={`${t('trip.card.active')} ${placeName(active.place, locale)}`}
            style={layout.section}
            onPress={() => navigation.navigate('ActiveTrip', { tripId: active.id })}
          >
            <AppText variant="caption" tone="teal700">
              {t('trip.card.active')}
            </AppText>
            <AppText variant="h3">{placeName(active.place, locale)}</AppText>
            <AppText variant="body">{t('trip.card.backBy', { time: formatClock(new Date(active.backBy), locale) })}</AppText>
          </Pressable>
          {active.alertSentAt ? (
            <AppText testID="home.trip.alerted" variant="small" accessibilityRole="alert" style={styles.alerted}>
              {t('trip.card.alerted', { name: active.contact.name })}
            </AppText>
          ) : null}
          <AppButton
            testID="home.trip.checkout"
            label={t('trip.card.checkout')}
            disabled={disabled}
            onPress={() => void actions.checkOutTrip(active)}
          />
          {active.alertSentAt ? null : (
            <BackByPicker
              trip={active}
              locale={locale}
              disabled={disabled}
              onChange={backBy => actions.changeBackBy(active, backBy)}
            />
          )}
        </View>
      ) : null}
      {planned.map(trip => (
        <View key={trip.id} testID={`home.trip.planned.${trip.id}`} style={layout.section}>
          <AppText variant="caption">
            {t('trip.card.planned', { date: formatDay(tashkentDay(new Date(trip.startAt)), locale) })}
          </AppText>
          <AppText variant="h3">{placeName(trip.place, locale)}</AppText>
          <View style={layout.buttons}>
            <View style={layout.button}>
              <AppButton
                testID="home.trip.planned.start"
                label={t('trip.card.start')}
                disabled={disabled || active !== null}
                onPress={() =>
                  void actions.startTrip(trip).then(started => {
                    if (started) {
                      navigation.navigate('ActiveTrip', { tripId: trip.id });
                    }
                  })
                }
              />
            </View>
            <View style={layout.button}>
              <AppButton
                testID="home.trip.planned.edit"
                variant="white"
                label={t('trip.card.edit')}
                disabled={disabled}
                onPress={() => navigation.navigate('TripPlan', { placeId: trip.place.id, tripId: trip.id })}
              />
            </View>
            <View style={layout.button}>
              <AppButton
                testID="home.trip.planned.delete"
                variant="white"
                label={t('trip.card.delete')}
                disabled={disabled}
                onPress={() => setDeleting({ trip, closing: false })}
              />
            </View>
          </View>
        </View>
      ))}
      {deleting ? (
        <Sheet
          testID="home.trip.delete.sheet"
          accessibilityLabel={t('trip.card.deleteConfirm')}
          closing={deleting.closing}
          onDismiss={() => setDeleting(null)}
        >
          <AppText variant="h2" accessibilityRole="header">
            {t('trip.card.deleteConfirm')}
          </AppText>
          <AppButton
            testID="home.trip.delete.confirm"
            variant="danger"
            label={t('trip.card.delete')}
            disabled={disabled}
            onPress={() => {
              setDeleting({ trip: deleting.trip, closing: true });
              void actions.deleteTrip(deleting.trip);
            }}
          />
          <AppButton
            testID="home.trip.delete.cancel"
            variant="white"
            label={t('common.cancel')}
            onPress={() => setDeleting({ trip: deleting.trip, closing: true })}
          />
        </Sheet>
      ) : null}
    </View>
  );
}

const layout = StyleSheet.create({
  card: { padding: spacing[16], gap: spacing[16] },
  section: { gap: spacing[8] },
  buttons: { flexDirection: 'row', gap: spacing[8] },
  button: { flex: 1 },
});

const useStyles = createThemedStyles(c => ({
  card: {
    borderRadius: radii.card,
    borderWidth: borders.card,
    borderColor: c.line,
    backgroundColor: c.card,
  },
  alerted: { color: c.red700 },
}));
