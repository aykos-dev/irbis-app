import { Image } from 'react-native';

import xoGlyph from '../../../../assets/images/campfire/gameGlyph_xo.png';
import { palette } from '../../../../shared/constants/colors';
import { campSizes } from '../../campTheme';

/** CampHub tile glyph (AC1): the owner's black X·O glyph, tinted white on the tile. */
export function XoGlyph({ size = campSizes.gameGlyph }: { size?: number }) {
  return (
    <Image
      testID="camp.glyph.xo"
      source={xoGlyph}
      style={{ width: size, height: size }}
      tintColor={palette.white}
      resizeMode="contain"
    />
  );
}
