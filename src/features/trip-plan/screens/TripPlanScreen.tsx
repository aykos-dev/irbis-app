import { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { RootStackScreenProps } from '../../../app/navigation/types';
import { placeHeroes } from '../../../assets/images/places';
import { useGetEmergencyContact } from '../../../shared/api/generated/me/me';
import type { PlaceDetailDto, TripDto, TripPreviewDto } from '../../../shared/api/generated/model';
import { usePlacesGet } from '../../../shared/api/generated/places/places';
import { useGetCurrentTrips } from '../../../shared/api/generated/trips/trips';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { ErrorState } from '../../../shared/components/ErrorState';
import { Icon } from '../../../shared/components/Icon';
import { Pressable } from '../../../shared/components/Pressable';
import { Screen } from '../../../shared/components/Screen';
import { Skeleton } from '../../../shared/components/Skeleton';
import { StatusChip } from '../../../shared/components/StatusChip';
import { borders, radii, screenPadding, sizes, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles, useTheme } from '../../../shared/contexts/theme';
import { useLocale } from '../../../shared/hooks/useLocale';
import { useNetworkStatus } from '../../../shared/hooks/useNetworkStatus';
import { t, type Locale } from '../../../shared/i18n';
import { qaLog } from '../../../shared/utils/qaLog';
import { AlertSwitch } from '../components/AlertSwitch';
import { ContactCard } from '../components/ContactCard';
import { ContactSheet } from '../components/ContactSheet';
import { GearList } from '../components/GearList';
import { TimeRow } from '../components/TimeRow';
import { WhenPicker } from '../components/WhenPicker';
import { draftTicksId } from '../gearTicks';
import { useGearTicks } from '../hooks/useGearTicks';
import { useSubmitTrip } from '../hooks/useSubmitTrip';
import { useTripPreview } from '../hooks/useTripPreview';
import {
  ALERT_DELAY_MIN,
  DEFAULT_BACK_BY,
  DEFAULT_START,
  addDays,
  addMinutes,
  daysBetween,
  formatClock,
  tashkentClock,
  tashkentDay,
  timesError,
  weekendDays,
  windowInstants,
  type TripWindow,
} from '../tripTimes';

const HERO_HEIGHT = 120;
const SKELETON_HERO = 120;
const SKELETON_BLOCK = 96;

/**
 * Trip plan (AC1–AC6): place, when, start / back-by, sunset, emergency contact, gear and the
 * auto-alert, then Save plan or Start adventure. `tripId` edits a saved plan.
 */
export function TripPlanScreen({ navigation, route }: RootStackScreenProps<'TripPlan'>) {
  const { placeId, tripId } = route.params;
  const place = usePlacesGet(placeId);
  const trips = useGetCurrentTrips({ query: { enabled: tripId !== undefined } });
  const trip = tripId
    ? ([trips.data?.active, ...(trips.data?.planned ?? [])].find(item => item?.id === tripId) ?? null)
    : null;
  const waitingForTrip = tripId !== undefined && trips.isPending;

  let body;
  if (place.data && !waitingForTrip) {
    body = <TripPlanForm place={place.data} trip={trip} onDone={() => navigation.goBack()} />;
  } else if (place.error || trips.error) {
    const error = place.error ?? trips.error;
    body = (
      <Screen testID="trip.screen" scroll>
        <BackButton onPress={() => navigation.goBack()} />
        {error ? (
          <ErrorState
            testID="trip.error"
            retryTestID="trip.retry"
            error={error}
            onRetry={() => {
              void place.refetch();
              if (tripId) {
                void trips.refetch();
              }
            }}
          />
        ) : null}
      </Screen>
    );
  } else {
    body = (
      <Screen testID="trip.screen" scroll>
        <BackButton onPress={() => navigation.goBack()} />
        <View testID="trip.skeleton" style={layout.section}>
          <Skeleton height={SKELETON_HERO} radius={radii.card} />
          <Skeleton height={SKELETON_BLOCK} radius={radii.card} />
          <Skeleton height={SKELETON_BLOCK} radius={radii.card} />
        </View>
      </Screen>
    );
  }
  return body;
}

function initialWindow(trip: TripDto | null, sat: string): TripWindow {
  if (!trip) {
    return { day: sat, start: DEFAULT_START, backDay: sat, backBy: DEFAULT_BACK_BY };
  }
  const startAt = new Date(trip.startAt);
  const backBy = new Date(trip.backBy);
  return {
    day: tashkentDay(startAt),
    start: tashkentClock(startAt),
    backDay: tashkentDay(backBy),
    backBy: tashkentClock(backBy),
  };
}

function localizedName(place: PlaceDetailDto, locale: Locale): string {
  return place.name[locale] ?? place.name.uz;
}

type FormProps = { place: PlaceDetailDto; trip: TripDto | null; onDone: () => void };

function TripPlanForm({ place, trip, onDone }: FormProps) {
  const locale = useLocale();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { isOnline } = useNetworkStatus();
  const [openedAt] = useState(() => new Date());
  const weekend = weekendDays(openedAt);
  const [plan, setPlan] = useState<TripWindow>(() => initialWindow(trip, weekend.sat));
  const [alertEnabled, setAlertEnabled] = useState(trip?.alertEnabled ?? true);
  const [editingContact, setEditingContact] = useState(false);
  const ticksId = trip?.id ?? draftTicksId(place.id);
  const { ticks, toggle } = useGearTicks(ticksId);
  const contactQuery = useGetEmergencyContact();
  const contact = contactQuery.data ? contactQuery.data : null;
  const { submit, pending, timesRejected, clearTimesRejected } = useSubmitTrip();

  const belowLevel = place.viewer.level < place.requiredLevel;
  const logged = useRef(false);
  useEffect(() => {
    if (logged.current) {
      return;
    }
    logged.current = true;
    qaLog('trip_plan_open', { placeId: place.id, belowLevel });
  }, [place.id, belowLevel]);

  const { startAt, backBy } = windowInstants(plan);
  const startIso = startAt.toISOString();
  const backByIso = backBy.toISOString();
  const inlineError = timesError(plan, openedAt);
  const timesMessage = inlineError ? t(`trip.${inlineError}`) : timesRejected ? t('trip.timesInvalid') : null;
  const preview = useTripPreview(place.id, startIso, backByIso, inlineError === null);

  const changeWindow = (next: TripWindow) => {
    clearTimesRejected();
    setPlan(next);
  };
  const changeDay = (day: string) => {
    const nights = daysBetween(plan.day, plan.backDay);
    changeWindow({ ...plan, day, backDay: addDays(day, nights) });
  };

  const alertAt = trip && trip.backBy === backByIso ? new Date(trip.alertAt) : addMinutes(backBy, ALERT_DELAY_MIN);
  const alertLine = contact ? t('trip.alertAt', { name: contact.name, time: formatClock(alertAt, locale) }) : null;

  const blocked = !isOnline || !contact || inlineError !== null || pending;
  const send = (start: boolean) => {
    void submit({ placeId: place.id, startAt: startIso, backBy: backByIso, alertEnabled, trip, ticksId, onDone }, start);
  };

  let footnote = t('trip.sharedOnStart');
  if (!isOnline) {
    footnote = t('trip.offline');
  } else if (!contact && !contactQuery.isPending) {
    footnote = t('trip.contactRequired');
  }

  return (
    <View style={styles.root}>
      <Screen testID="trip.screen" scroll bottomInset={false}>
        <BackButton onPress={onDone} />
        <View style={layout.head}>
          <AppText variant="h1" accessibilityRole="header">
            {t('trip.title')}
          </AppText>
          <AppText variant="body" tone="muted">
            {t('trip.subtitle')}
          </AppText>
        </View>
        <View testID="trip.place" style={styles.card}>
          <Image
            source={placeHeroes[place.type]}
            resizeMode="cover"
            accessible={false}
            style={layout.hero}
          />
          <AppText testID="trip.place-name" variant="h3" style={layout.placeName}>
            {localizedName(place, locale)}
          </AppText>
        </View>
        {belowLevel ? (
          <StatusChip
            testID="trip.level-caution"
            variant="caution"
            label={t('trip.levelCaution', { level: place.requiredLevel })}
          />
        ) : null}
        <WhenPicker
          day={plan.day}
          today={weekend.today}
          sat={weekend.sat}
          sun={weekend.sun}
          locale={locale}
          onChange={changeDay}
        />
        <View style={layout.section}>
          <TimeRow
            testID="trip.start-time"
            label={t('trip.start')}
            day={plan.day}
            clock={plan.start}
            locale={locale}
            onClockChange={start => changeWindow({ ...plan, start })}
          />
          <TimeRow
            testID="trip.backby-time"
            label={t('trip.backBy')}
            day={plan.backDay}
            clock={plan.backBy}
            locale={locale}
            onClockChange={clock => changeWindow({ ...plan, backBy: clock })}
            dayPicker={{ minDay: plan.day, onDayChange: backDay => changeWindow({ ...plan, backDay }) }}
          />
          {timesMessage ? (
            <AppText testID="trip.times-error" variant="small" accessibilityRole="alert" style={styles.error}>
              {timesMessage}
            </AppText>
          ) : null}
        </View>
        <SunsetLine
          preview={preview.data}
          loading={preview.isPending && preview.fetchStatus !== 'idle'}
          error={preview.data ? null : preview.error}
          onRetry={() => void preview.refetch()}
          locale={locale}
        />
        <ContactCard
          contact={contact}
          loading={contactQuery.isPending}
          error={contactQuery.error}
          onRetry={() => void contactQuery.refetch()}
          onEdit={() => setEditingContact(true)}
        />
        {preview.data ? (
          <GearList items={preview.data.gear} ticks={ticks} locale={locale} onToggle={toggle} />
        ) : null}
        <AlertSwitch value={alertEnabled} onChange={setAlertEnabled} alertLine={alertLine} />
      </Screen>
      <View style={[styles.footer, { paddingBottom: insets.bottom || spacing[20], paddingStart: screenPadding + insets.left, paddingEnd: screenPadding + insets.right }]}>
        <AppText testID="trip.footnote" variant="small" style={layout.footnote}>
          {footnote}
        </AppText>
        <View style={layout.buttons}>
          <View style={layout.button}>
            <AppButton testID="trip.save" variant="white" label={t('trip.save')} disabled={blocked} onPress={() => send(false)} />
          </View>
          <View style={layout.button}>
            <AppButton
              testID="trip.start"
              label={t('trip.startCta')}
              disabled={blocked}
              loading={pending}
              onPress={() => send(true)}
            />
          </View>
        </View>
      </View>
      {editingContact ? (
        <ContactSheet
          initial={contact ? { name: contact.name, relation: contact.relation } : null}
          onDismiss={() => setEditingContact(false)}
        />
      ) : null}
    </View>
  );
}

type SunsetProps = {
  preview: TripPreviewDto | undefined;
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  locale: Locale;
};

/** Sunset + daylight buffer (AC3); after-dark caution when the buffer is negative. */
function SunsetLine({ preview, loading, error, onRetry, locale }: SunsetProps) {
  if (preview) {
    const time = formatClock(new Date(preview.sunsetAt), locale);
    const buffer = preview.daylightBufferMin;
    return (
      <View style={layout.section}>
        <AppText testID="trip.sunset" variant="body">
          {buffer === null ? t('trip.sunsetOnly', { time }) : t('trip.sunset', { time, min: buffer })}
        </AppText>
        {buffer !== null && buffer < 0 ? (
          <StatusChip testID="trip.after-dark" variant="caution" label={t('trip.afterDark')} />
        ) : null}
      </View>
    );
  }
  if (error) {
    return <ErrorState testID="trip.preview-error" retryTestID="trip.preview-retry" error={error} onRetry={onRetry} />;
  }
  return loading ? <Skeleton height={spacing[44]} radius={radii.tile} /> : null;
}

function BackButton({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      testID="trip.back"
      accessibilityRole="button"
      accessibilityLabel={t('places.back')}
      onPress={onPress}
      style={styles.back}
    >
      <Icon name="back" color={colors.ink} />
    </Pressable>
  );
}

const layout = StyleSheet.create({
  head: { gap: spacing[4] },
  section: { gap: spacing[12] },
  hero: { width: '100%', height: HERO_HEIGHT },
  placeName: { padding: spacing[14] },
  footnote: { textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: spacing[12] },
  button: { flex: 1 },
});

const useStyles = createThemedStyles(c => ({
  root: { flex: 1, backgroundColor: c.bg },
  card: {
    borderRadius: radii.card,
    borderWidth: borders.card,
    borderColor: c.line,
    backgroundColor: c.card,
    overflow: 'hidden',
  },
  error: { color: c.red700 },
  footer: {
    gap: spacing[10],
    paddingTop: spacing[12],
    borderTopWidth: borders.card,
    borderTopColor: c.line,
    backgroundColor: c.bg,
  },
  back: {
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.card,
    borderWidth: borders.card,
    borderColor: c.line,
  },
}));
