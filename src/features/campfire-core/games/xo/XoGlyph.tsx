import Svg, { Circle, Path } from 'react-native-svg';

import { palette } from '../../../../shared/constants/colors';
import { sizes } from '../../../../shared/constants/spacing';
import { campSizes } from '../../campTheme';

/** CampHub tile glyph (AC1): an X and an O in the white tile stroke. */
export function XoGlyph({ size = campSizes.gameGlyph }: { size?: number }) {
  const stroke = {
    stroke: palette.white,
    strokeWidth: sizes.iconStroke,
    strokeLinecap: 'round' as const,
    fill: 'none',
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M3 7l6 6M9 7l-6 6" {...stroke} />
      <Circle cx="17" cy="14" r="4" {...stroke} />
    </Svg>
  );
}
