import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useCallback, useState } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MainTabScreenProps } from '../../../app/navigation/types';
import type { PlaceListItemDto, PlaceListResponseDto } from '../../../shared/api/generated/model';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { EmptyState } from '../../../shared/components/EmptyState';
import { ErrorState } from '../../../shared/components/ErrorState';
import { OfflineBanner } from '../../../shared/components/OfflineBanner';
import { Skeleton } from '../../../shared/components/Skeleton';
import { radii, screenPadding, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles, useTheme } from '../../../shared/contexts/theme';
import { useLocale } from '../../../shared/hooks/useLocale';
import { useNetworkStatus } from '../../../shared/hooks/useNetworkStatus';
import { t, type Locale } from '../../../shared/i18n';
import { FilterChips, type FilterKind } from '../components/FilterChips';
import { FilterSheet } from '../components/FilterSheet';
import { LocationBanner } from '../components/LocationBanner';
import { PlaceCard } from '../components/PlaceCard';
import { PlacesMap, type MapCamera } from '../components/PlacesMap';
import { exploreFilters, useExploreFilters, type ExploreFilters } from '../exploreFilters';
import { useExplorePlaces } from '../hooks/useExplorePlaces';
import { useOrigin } from '../hooks/useOrigin';

/** Collapsed ~40 %, drag up to expand (AC4). */
const SNAP_POINTS = ['40%', '88%'];
/** Without device location the camera opens on Tashkent (AC6). */
const TASHKENT: MapCamera = { lat: 41.2995, lng: 69.2401, zoom: 7 };
const USER_ZOOM = 8;
const SKELETON_ROWS = 3;
const SKELETON_TITLE = 24;
const SKELETON_CARD = 84;

/** Explore tab (AC4–AC6): clustered map, distance-sorted list sheet, filters, location origin. */
export function ExploreScreen({ navigation }: MainTabScreenProps<'Explore'>) {
  const insets = useSafeAreaInsets();
  const { scheme } = useTheme();
  const styles = useStyles();
  const locale = useLocale();
  const { isOnline } = useNetworkStatus();
  const filters = useExploreFilters();
  const origin = useOrigin();
  const [appliedAt, setAppliedAt] = useState(0);
  const [sheet, setSheet] = useState<{ kind: FilterKind; closing: boolean } | null>(null);
  const query = useExplorePlaces(filters, origin.coords, origin.state.status !== 'pending', appliedAt);
  const { coords } = origin;

  const camera: MapCamera = coords ? { ...coords, zoom: USER_ZOOM } : TASHKENT;

  const openPlace = useCallback(
    (place: PlaceListItemDto) => navigation.navigate('Place', { id: place.id, ...coords }),
    [navigation, coords],
  );

  const apply = (next: ExploreFilters) => {
    exploreFilters.set(next);
    setAppliedAt(Date.now());
    setSheet(current => (current ? { ...current, closing: true } : null));
  };

  const reset = () => {
    exploreFilters.reset();
    setAppliedAt(Date.now());
  };

  const { data } = query;
  let body;
  if (data) {
    body =
      data.items.length > 0 ? (
        <PlacesList data={data} locale={locale} onOpenPlace={openPlace} />
      ) : (
        <EmptyState
          testID="explore.empty"
          inline
          mascot="worried"
          mascotLabel={t('places.explore.empty')}
          title={t('places.explore.empty')}
          action={
            <AppButton testID="explore.filter.reset" label={t('places.filter.reset')} onPress={reset} />
          }
        />
      );
  } else if (query.error) {
    body = (
      <ErrorState
        testID="explore.error"
        retryTestID="explore.retry"
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    );
  } else if (!isOnline) {
    body = (
      <AppText testID="explore.offline" variant="body" style={layout.padded}>
        {t('errors.network')}
      </AppText>
    );
  } else {
    body = <ListSkeleton />;
  }

  return (
    <View testID="explore.screen" style={styles.root}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
      <PlacesMap places={data?.items ?? []} view={camera} onOpenPlace={openPlace} />
      <View
        style={[
          layout.overlay,
          { paddingTop: insets.top + spacing[8], paddingStart: screenPadding + insets.left, paddingEnd: screenPadding + insets.right },
        ]}
        pointerEvents="box-none"
      >
        <FilterChips filters={filters} onOpen={kind => setSheet({ kind, closing: false })} />
        {origin.state.status === 'none' ? <LocationBanner onTurnOn={origin.turnOn} /> : null}
        <OfflineBanner />
      </View>
      <BottomSheet
        index={0}
        snapPoints={SNAP_POINTS}
        enableDynamicSizing={false}
        backgroundStyle={styles.sheet}
        handleIndicatorStyle={styles.handle}
      >
        <View testID="explore.sheet" style={layout.fill} accessibilityLabel={t('places.explore.list')}>
          {body}
        </View>
      </BottomSheet>
      {sheet ? (
        <FilterSheet
          kind={sheet.kind}
          filters={filters}
          closing={sheet.closing}
          onApply={apply}
          onDismiss={() => setSheet(null)}
        />
      ) : null}
    </View>
  );
}

type ListProps = {
  data: PlaceListResponseDto;
  locale: Locale;
  onOpenPlace: (place: PlaceListItemDto) => void;
};

/** Header (count by origin, "Sorted by distance") and the cards, in API order (AC4). */
function PlacesList({ data, locale, onOpenPlace }: ListProps) {
  const countKey = data.origin === 'device' ? 'places.explore.countDevice' : 'places.explore.countTashkent';
  return (
    <BottomSheetFlatList
      data={data.items}
      keyExtractor={(item: PlaceListItemDto) => item.id}
      contentContainerStyle={layout.list}
      ListHeaderComponent={
        <View style={layout.header}>
          <AppText testID="explore.count" variant="h2" accessibilityRole="header">
            {t(countKey, { count: data.total })}
          </AppText>
          <AppText variant="small" tone="muted">
            {t('places.explore.sorted')}
          </AppText>
        </View>
      }
      renderItem={({ item }: { item: PlaceListItemDto }) => (
        <PlaceCard place={item} locale={locale} onPress={onOpenPlace} />
      )}
    />
  );
}

function ListSkeleton() {
  return (
    <View testID="explore.skeleton" style={layout.list}>
      <Skeleton height={SKELETON_TITLE} width="60%" />
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <Skeleton key={index} height={SKELETON_CARD} radius={radii.card} />
      ))}
    </View>
  );
}

const layout = StyleSheet.create({
  fill: { flex: 1 },
  overlay: { position: 'absolute', top: 0, start: 0, end: 0, gap: spacing[8] },
  list: { gap: spacing[12], paddingHorizontal: screenPadding, paddingBottom: spacing[24] },
  padded: { paddingHorizontal: screenPadding },
  header: { gap: spacing[4], paddingBottom: spacing[4] },
});

const useStyles = createThemedStyles(c => ({
  root: { flex: 1, backgroundColor: c.bg },
  sheet: { backgroundColor: c.card, borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet },
  handle: { backgroundColor: c.line, width: spacing[44] },
}));
