import { Image } from 'react-native';

import crocGlyph from '../../../../assets/images/campfire/gameGlyph_croc.png';
import { palette } from '../../../../shared/constants/colors';

type Props = { size: number };

/** Crocodile tile glyph: the owner's black croc glyph, tinted white on the game colour. */
export function CrocGlyph({ size }: Props) {
  return (
    <Image
      testID="camp.glyph.croc"
      source={crocGlyph}
      style={{ width: size, height: size }}
      tintColor={palette.white}
      resizeMode="contain"
    />
  );
}
