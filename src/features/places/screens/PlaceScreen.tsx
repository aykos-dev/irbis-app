import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { RootStackScreenProps } from '../../../app/navigation/types';
import type { PlaceConditionDto, PlaceDetailDto } from '../../../shared/api/generated/model';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { ConditionCard } from '../../../shared/components/conditions/ConditionCard';
import { HazardsNow } from '../../../shared/components/conditions/HazardsNow';
import { WeatherCard } from '../../../shared/components/conditions/WeatherCard';
import { EmptyState } from '../../../shared/components/EmptyState';
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
import { useRequireAccount } from '../../../shared/hooks/useRequireAccount';
import { t, type Locale } from '../../../shared/i18n';
import { DifficultyBoots } from '../components/DifficultyBoots';
import { LevelCard } from '../components/LevelCard';
import { PlaceHero } from '../components/PlaceHero';
import { SeasonBar } from '../components/SeasonBar';
import { TypePill } from '../components/TypePill';
import { formatDistance } from '../formatDistance';
import { usePlace } from '../hooks/usePlace';
import { usePlaceCondition } from '../hooks/usePlaceCondition';

const SKELETON_HERO = 200;
const SKELETON_TITLE = 32;
const SKELETON_TILE = 72;
const SKELETON_CARD = 120;

/** Statuses that hide "Start adventure" (trip-plan AC1, product rule). */
const NO_TRIP_STATUSES: ReadonlySet<string> = new Set(['not_now', 'seasonal_lock']);

/** Localised text with the Uzbek original as fallback (AC7). */
export function localized<T extends string | null>(
  text: { uz: T; ru: string | null; en: string | null },
  locale: Locale,
): string | T {
  return text[locale] ?? text.uz;
}

/**
 * Place screen (AC7, AC8): one place's facts, required level, weekend condition and weather,
 * season and hazards. The condition loads alongside the place; its failure never hides the place.
 */
export function PlaceScreen({ navigation, route }: RootStackScreenProps<'Place'>) {
  const { id, lat, lng } = route.params;
  const coords = lat !== undefined && lng !== undefined ? { lat, lng } : undefined;
  const locale = useLocale();
  const { isOnline } = useNetworkStatus();
  const { data, error, isNotFound, refetch } = usePlace(id, coords);
  const condition = usePlaceCondition(id, data?.slug);
  const requireAccount = useRequireAccount('trip');
  const conditionStatus = condition.data?.status ?? null;
  // Hidden until the condition settles, so a Not now place never flashes the button.
  const showTripCta =
    data !== undefined &&
    !condition.isPending &&
    (conditionStatus === null || !NO_TRIP_STATUSES.has(conditionStatus));
  // A cold deep link leaves Place alone in the stack: fall back to the Explore tab (D2).
  const goBack = () =>
    navigation.canGoBack()
      ? navigation.goBack()
      : navigation.reset({ index: 0, routes: [{ name: 'MainTabs', params: { screen: 'Explore' } }] });

  let body;
  if (data) {
    body = (
      <PlaceBody
        place={data}
        locale={locale}
        condition={
          <ConditionCard
            condition={condition.data}
            error={condition.data ? null : condition.error}
            isOnline={isOnline}
            onRetry={() => void condition.refetch()}
            locale={locale}
          />
        }
        conditionData={condition.data}
      />
    );
  } else if (isNotFound) {
    body = (
      <EmptyState
        testID="place.not-found"
        mascot="worried"
        mascotLabel={t('places.notFound')}
        title={t('places.notFound')}
        action={<AppButton testID="place.not-found-back" label={t('places.back')} onPress={goBack} />}
      />
    );
  } else if (error) {
    body = (
      <ErrorState
        testID="place.error"
        retryTestID="place.retry"
        error={error}
        onRetry={() => void refetch()}
      />
    );
  } else if (!isOnline) {
    body = (
      <AppText testID="place.offline" variant="body">
        {t('errors.network')}
      </AppText>
    );
  } else {
    body = <PlaceSkeleton />;
  }

  return (
    <View style={layout.fill}>
      <Screen testID="place.screen" scroll bottomInset={!showTripCta}>
        <BackButton onPress={goBack} />
        {body}
      </Screen>
      {showTripCta ? (
        <StartAdventureBar
          onPress={() => requireAccount(() => navigation.navigate('TripPlan', { placeId: id }))}
        />
      ) : null}
    </View>
  );
}

/** Sticky "Start adventure" (trip-plan AC1); guests go through the account gate first. */
function StartAdventureBar({ onPress }: { onPress: () => void }) {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  return (
    <View
      style={[
        styles.ctaBar,
        {
          paddingBottom: insets.bottom || spacing[20],
          paddingStart: screenPadding + insets.left,
          paddingEnd: screenPadding + insets.right,
        },
      ]}
    >
      <AppButton testID="place.start-adventure" label={t('trip.place.startAdventure')} onPress={onPress} />
    </View>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      testID="place.back"
      accessibilityRole="button"
      accessibilityLabel={t('places.back')}
      onPress={onPress}
      style={styles.back}
    >
      <Icon name="back" color={colors.ink} />
    </Pressable>
  );
}

function PlaceSkeleton() {
  return (
    <View testID="place.skeleton" style={layout.section}>
      <Skeleton height={SKELETON_HERO} radius={radii.card} />
      <Skeleton height={SKELETON_TITLE} width="60%" />
      <View style={layout.tiles}>
        <View style={layout.tile}>
          <Skeleton height={SKELETON_TILE} />
        </View>
        <View style={layout.tile}>
          <Skeleton height={SKELETON_TILE} />
        </View>
      </View>
      <Skeleton height={SKELETON_CARD} radius={radii.card} />
    </View>
  );
}

type BodyProps = {
  place: PlaceDetailDto;
  locale: Locale;
  /** The condition card, already wired to its query and the network state. */
  condition: ReactNode;
  conditionData: PlaceConditionDto | undefined;
};

function PlaceBody({ place, locale, condition, conditionData }: BodyProps) {
  const styles = useStyles();
  const description = localized(place.description, locale);
  const paragraphs = description ? description.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean) : [];
  const distanceLabel = place.origin === 'device' ? t('places.fromYou') : t('places.fromTashkent');
  const distance = t('places.distanceKm', { d: formatDistance(place.distanceM, locale) });
  const elevation = t('places.elevationValue', {
    n: new Intl.NumberFormat(locale).format(place.elevationM),
  });

  return (
    <>
      <PlaceHero type={place.type} />
      <View style={layout.head}>
        <TypePill type={place.type} />
        <AppText testID="place.name" variant="h1" accessibilityRole="header">
          {localized(place.name, locale)}
        </AppText>
        {place.region ? <AppText variant="body" tone="muted">{place.region}</AppText> : null}
      </View>
      <View style={layout.tiles}>
        <View testID="place.elevation" style={[layout.tile, styles.tile]} accessible>
          <AppText variant="caption">{t('places.elevation')}</AppText>
          <AppText variant="h2">{elevation}</AppText>
        </View>
        <View testID="place.distance" style={[layout.tile, styles.tile]} accessible>
          <AppText variant="caption">{distanceLabel}</AppText>
          <AppText variant="h2">{distance}</AppText>
        </View>
      </View>
      <DifficultyBoots difficulty={place.difficulty} />
      <LevelCard requiredLevel={place.requiredLevel} qualifies={place.viewer.qualifies} />
      {condition}
      {conditionData ? <WeatherCard weekend={conditionData.weekend} /> : null}
      {paragraphs.length > 0 ? (
        <View testID="place.description" style={layout.section}>
          <AppText variant="h3" accessibilityRole="header">
            {t('places.about')}
          </AppText>
          {paragraphs.map((paragraph, index) => (
            <AppText key={index} variant="body">
              {paragraph}
            </AppText>
          ))}
        </View>
      ) : null}
      <View style={layout.section}>
        <AppText variant="h3" accessibilityRole="header">
          {t('places.season.title')}
        </AppText>
        <SeasonBar season={place.season} locale={locale} />
      </View>
      {conditionData && conditionData.hazards.length > 0 ? (
        <HazardsNow hazards={conditionData.hazards} />
      ) : (
        <PlaceHazards hazards={place.hazards} />
      )}
    </>
  );
}

function PlaceHazards({ hazards }: { hazards: PlaceDetailDto['hazards'] }) {
  return (
    <View style={layout.section}>
      <AppText variant="h3" accessibilityRole="header">
        {t('places.hazards.title')}
      </AppText>
      {hazards.length > 0 ? (
        <View testID="place.hazards" style={layout.chips}>
          {hazards.map(hazard => (
            <StatusChip
              key={hazard}
              testID={`place.hazard-${hazard}`}
              variant="caution"
              label={t(`places.hazard.${hazard}`)}
            />
          ))}
        </View>
      ) : (
        <AppText testID="place.hazards-empty" variant="body" tone="muted">
          {t('places.hazards.empty')}
        </AppText>
      )}
    </View>
  );
}

const layout = StyleSheet.create({
  fill: { flex: 1 },
  head: { gap: spacing[8] },
  section: { gap: spacing[12] },
  tiles: { flexDirection: 'row', gap: spacing[12] },
  tile: { flex: 1, gap: spacing[4] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[8] },
});

const useStyles = createThemedStyles(c => ({
  ctaBar: {
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
  tile: {
    padding: spacing[14],
    borderRadius: radii.tile,
    borderWidth: borders.card,
    borderColor: c.line,
    backgroundColor: c.card,
  },
}));
