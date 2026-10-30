import { memo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { bootSvg } from '../../../assets/svg/boot';
import type { PlaceListItemDto } from '../../../shared/api/generated/model';
import { AppText } from '../../../shared/components/AppText';
import { Icon } from '../../../shared/components/Icon';
import { levelMeta } from '../../../shared/components/levels/levelMeta';
import { statusVariant } from '../../../shared/components/conditions/reasonText';
import { Pressable } from '../../../shared/components/Pressable';
import { StatusChip } from '../../../shared/components/StatusChip';
import { difficultyBootColor } from '../../../shared/constants/colors';
import { borders, radii, sizes, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles, useTheme } from '../../../shared/contexts/theme';
import { t, type Locale } from '../../../shared/i18n';
import { formatDistance } from '../../../shared/utils/units';
import { placeTypes } from '../placeTypes';
import { localized } from '../screens/PlaceScreen';

const BOOTS_MAX = 5;
const BOOT = 14;
/** Thumb shows the type hero in a 390×240-aspect frame. */
const THUMB_HEIGHT = 56;
const THUMB_WIDTH = (THUMB_HEIGHT * 390) / 240;
const LOCK_ICON = 12;

type Props = {
  place: PlaceListItemDto;
  locale: Locale;
  /** The viewer's level (1 for a guest or before it loads); places above it show a lock (levels AC8). */
  viewerLevel: number;
  onPress: (place: PlaceListItemDto) => void;
};

/**
 * One Explore row (AC4): type illustration, name (locale → uz), "Type · distance" with the weekend
 * status chip when there is one (conditions AC8), boots, and a "Level N" lock chip in the level colour
 * when the place needs a higher level than the viewer's (levels AC8).
 */
export const PlaceCard = memo(function PlaceCard({ place, locale, viewerLevel, onPress }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const info = placeTypes[place.type];
  const name = localized(place.name, locale);
  const meta = t('places.explore.cardMeta', {
    type: t(info.labelKey),
    distance: formatDistance(place.distanceM),
  });
  const difficulty = t('places.difficulty', { d: place.difficulty });
  const status = place.conditionStatus ?? null;
  const statusLabel = status ? t(`conditions.status.${status}`) : null;
  const locked = place.requiredLevel > viewerLevel ? levelMeta(place.requiredLevel) : null;
  const lockLabel = locked ? t('levels.lockA11y', { n: locked.level }) : null;
  const a11yLabel = [name, meta, statusLabel, difficulty, lockLabel].filter(Boolean).join(', ');

  return (
    <Pressable
      testID={`explore.card.${place.slug}`}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      onPress={() => onPress(place)}
      style={styles.card}
    >
      <View style={layout.thumb}>
        <Image source={info.hero} resizeMode="cover" accessible={false} style={layout.image} />
      </View>
      <View style={layout.text}>
        <AppText variant="h3" numberOfLines={1}>
          {name}
        </AppText>
        <View style={layout.meta}>
          <AppText variant="small" tone="muted" numberOfLines={1} style={layout.metaText}>
            {meta}
          </AppText>
          {status && statusLabel ? (
            <StatusChip
              testID={`explore.card.${place.slug}.status`}
              variant={statusVariant[status]}
              label={statusLabel}
            />
          ) : null}
        </View>
        <View style={layout.boots}>
          {locked ? (
            <View
              testID={`explore.card.${place.slug}.lock`}
              style={[layout.lock, { backgroundColor: locked.tint, borderColor: locked.color }]}
            >
              <Icon name="lock" color={locked.text} size={LOCK_ICON} />
              <AppText variant="chip" style={{ color: locked.text }}>
                {t('levels.lockChip', { n: locked.level })}
              </AppText>
            </View>
          ) : null}
          {Array.from({ length: BOOTS_MAX }, (_, index) => (
            <SvgXml
              key={index}
              xml={bootSvg}
              width={BOOT}
              height={BOOT}
              color={index < place.difficulty ? difficultyBootColor : colors.line}
            />
          ))}
        </View>
      </View>
    </Pressable>
  );
});

const layout = StyleSheet.create({
  thumb: {
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    borderRadius: radii.tile,
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  text: { flex: 1, gap: spacing[4] },
  boots: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  lock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    paddingHorizontal: spacing[6],
    borderRadius: radii.pill,
    borderWidth: borders.card,
    marginEnd: spacing[4],
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing[8] },
  metaText: { flexShrink: 1 },
});

const useStyles = createThemedStyles(c => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    padding: spacing[12],
    minHeight: sizes.touchTarget,
    borderRadius: radii.card,
    borderWidth: borders.card,
    borderColor: c.line,
    backgroundColor: c.card,
  },
}));
