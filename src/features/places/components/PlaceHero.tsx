import { Image, StyleSheet, View } from 'react-native';

import type { PlaceType } from '../../../shared/api/generated/model';
import { radii } from '../../../shared/constants/spacing';
import { placeTypes } from '../placeTypes';

/** Hero frame is 390×240; the image is cover-cropped, centred. */
const HERO_ASPECT = 390 / 240;

/** Type illustration hero (AC7) — generic per type, no photo gallery or counter. */
export function PlaceHero({ type }: { type: PlaceType }) {
  return (
    <View style={styles.hero} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Image
        testID="place.hero.image"
        source={placeTypes[type].hero}
        resizeMode="cover"
        accessible={false}
        style={styles.image}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    width: '100%',
    aspectRatio: HERO_ASPECT,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
});
