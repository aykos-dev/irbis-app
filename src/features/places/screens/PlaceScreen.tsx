import { StyleSheet, View } from 'react-native';

import type { RootStackScreenProps } from '../../../app/navigation/types';
import type { PlaceDetailDto } from '../../../shared/api/generated/model';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { EmptyState } from '../../../shared/components/EmptyState';
import { ErrorState } from '../../../shared/components/ErrorState';
import { Icon } from '../../../shared/components/Icon';
import { Pressable } from '../../../shared/components/Pressable';
import { Screen } from '../../../shared/components/Screen';
import { Skeleton } from '../../../shared/components/Skeleton';
import { StatusChip } from '../../../shared/components/StatusChip';
import { borders, radii, sizes, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles, useTheme } from '../../../shared/contexts/theme';
import { useLocale } from '../../../shared/hooks/useLocale';
import { useNetworkStatus } from '../../../shared/hooks/useNetworkStatus';
import { t, type Locale } from '../../../shared/i18n';
import { DifficultyBoots } from '../components/DifficultyBoots';
import { LevelCard } from '../components/LevelCard';
import { PlaceHero } from '../components/PlaceHero';
import { SeasonBar } from '../components/SeasonBar';
import { TypePill } from '../components/TypePill';
import { formatDistance } from '../formatDistance';
import { usePlace } from '../hooks/usePlace';

const SKELETON_HERO = 200;
const SKELETON_TITLE = 32;
const SKELETON_TILE = 72;
const SKELETON_CARD = 120;

/** Localised text with the Uzbek original as fallback (AC7). */
export function localized<T extends string | null>(
  text: { uz: T; ru: string | null; en: string | null },
  locale: Locale,
): string | T {
  return text[locale] ?? text.uz;
}

/** Place screen (AC7, AC8): one place's facts, required level, season and hazards. */
export function PlaceScreen({ navigation, route }: RootStackScreenProps<'Place'>) {
  const { id, lat, lng } = route.params;
  const coords = lat !== undefined && lng !== undefined ? { lat, lng } : undefined;
  const locale = useLocale();
  const { isOnline } = useNetworkStatus();
  const { data, error, isNotFound, refetch } = usePlace(id, coords);
  const goBack = () => navigation.goBack();

  let body;
  if (data) {
    body = <PlaceBody place={data} locale={locale} />;
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
    <Screen testID="place.screen" scroll>
      <BackButton onPress={goBack} />
      {body}
    </Screen>
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

function PlaceBody({ place, locale }: { place: PlaceDetailDto; locale: Locale }) {
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
      <View style={layout.section}>
        <AppText variant="h3" accessibilityRole="header">
          {t('places.hazards.title')}
        </AppText>
        {place.hazards.length > 0 ? (
          <View testID="place.hazards" style={layout.chips}>
            {place.hazards.map(hazard => (
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
    </>
  );
}

const layout = StyleSheet.create({
  head: { gap: spacing[8] },
  section: { gap: spacing[12] },
  tiles: { flexDirection: 'row', gap: spacing[12] },
  tile: { flex: 1, gap: spacing[4] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[8] },
});

const useStyles = createThemedStyles(c => ({
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
