import Svg, { Circle, Path } from 'react-native-svg';

import { palette } from '../../../../shared/constants/colors';
import { sizes } from '../../../../shared/constants/spacing';

type Props = { size: number };

/** Crocodile tile glyph: a side-on croc head with an open jaw and teeth (white on the game colour). */
export function CrocGlyph({ size }: Props) {
  const stroke = {
    stroke: palette.white,
    strokeWidth: sizes.iconStroke,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M3 12c0-3 2-5 5-5c2 0 3 1 4 2l9-1" {...stroke} />
      <Path d="M3 12l18 4" {...stroke} />
      <Path d="M9 9.5l1 1.5l1-1.2M14 9l1 1.5l1-1.6M8 13.3l1-1.4l1 1.8M13 14.4l1-1.4l1 1.8" {...stroke} />
      <Circle cx="7" cy="8.6" r="1.2" fill={palette.white} />
    </Svg>
  );
}
