import { memo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { bootSvg } from '../../../assets/svg/boot';
import type { PlaceListItemDto } from '../../../shared/api/generated/model';
import { AppText } from '../../../shared/components/AppText';
import { Pressable } from '../../../shared/components/Pressable';
import { difficultyBootColor } from '../../../shared/constants/colors';
import { borders, radii, sizes, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles, useTheme } from '../../../shared/contexts/theme';
import { t, type Locale } from '../../../shared/i18n';
import { formatDistance } from '../formatDistance';
import { placeTypes } from '../placeTypes';
import { localized } from '../screens/PlaceScreen';

const BOOTS_MAX = 5;
const BOOT = 14;
/** Thumb shows the type hero in a 390×240-aspect frame. */
const THUMB_HEIGHT = 56;
const THUMB_WIDTH = (THUMB_HEIGHT * 390) / 240;

type Props = {
  place: PlaceListItemDto;
  locale: Locale;
  onPress: (place: PlaceListItemDto) => void;
};

/** One Explore row (AC4): type illustration, name (locale → uz), "Type · distance", boots. */
export const PlaceCard = memo(function PlaceCard({ place, locale, onPress }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const info = placeTypes[place.type];
  const name = localized(place.name, locale);
  const meta = t('places.explore.cardMeta', {
    type: t(info.labelKey),
    distance: t('places.distanceKm', { d: formatDistance(place.distanceM, locale) }),
  });
  const difficulty = t('places.difficulty', { d: place.difficulty });

  return (
    <Pressable
      testID={`explore.card.${place.slug}`}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${meta}, ${difficulty}`}
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
        <AppText variant="small" tone="muted" numberOfLines={1}>
          {meta}
        </AppText>
        <View style={layout.boots}>
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
  boots: { flexDirection: 'row', gap: spacing[4] },
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
