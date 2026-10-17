import { StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import type { PlaceType } from '../../../shared/api/generated/model';
import { radii } from '../../../shared/constants/spacing';
import { placeTypes } from '../placeTypes';

/** Hero art is drawn at 390×240. */
const HERO_ASPECT = 390 / 240;

/** Type illustration hero (AC7) — generic per type, no photo gallery or counter. */
export function PlaceHero({ type }: { type: PlaceType }) {
  return (
    <View style={styles.hero} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <SvgXml
        xml={placeTypes[type].hero}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid slice"
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
});
