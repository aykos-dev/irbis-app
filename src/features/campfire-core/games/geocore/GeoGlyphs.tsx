import Svg, { Circle, Path } from 'react-native-svg';

import { palette } from '../../../../shared/constants/colors';
import { geocoreSizes, geoModeColors } from '../../campTheme';
import type { GeoMode } from './scoring';

const VIEWBOX = '0 0 24 24';

const strokeOf = (color: string) => ({
  stroke: color,
  strokeWidth: geocoreSizes.glyphStroke,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  fill: 'none',
});

type Props = { size: number; color?: string };

/** Geocore glyph (boards GeoHubSheet / GeoLobby): a globe, circle + equator + 2 meridians, stroked. */
export function GeocoreGlyph({ size, color = palette.white }: Props) {
  const stroke = strokeOf(color);
  return (
    <Svg testID="camp.glyph.geocore" width={size} height={size} viewBox={VIEWBOX}>
      <Circle cx="12" cy="12" r="9" {...stroke} />
      <Path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" {...stroke} />
    </Svg>
  );
}

/** One glyph per Geocore game, as on the boards; ink follows the mode tile colour. */
export function GeoModeGlyph({ mode, size }: { mode: GeoMode; size: number }) {
  const ink = geoModeColors[mode].ink;
  const stroke = strokeOf(ink);
  switch (mode) {
    case 'findCountry':
      return (
        <Svg testID="geo.glyph.findCountry" width={size} height={size} viewBox={VIEWBOX}>
          <Circle cx="12" cy="12" r="9" {...stroke} />
          <Path
            d="M12 6.5a3.2 3.2 0 0 1 3.2 3.2c0 2.4-3.2 5.8-3.2 5.8s-3.2-3.4-3.2-5.8A3.2 3.2 0 0 1 12 6.5z"
            fill={ink}
          />
        </Svg>
      );
    case 'capitalToCountry':
      return (
        <Svg testID="geo.glyph.capitalToCountry" width={size} height={size} viewBox={VIEWBOX}>
          <Path
            d="M7 3l1.4 2.9 3.1.4-2.3 2.2.6 3.1L7 10.1 4.2 11.6l.6-3.1-2.3-2.2 3.1-.4z"
            fill={ink}
          />
          <Path d="M12 15h8M17 12l3 3-3 3" {...stroke} />
          <Path d="M4 15.5l3-1.5 3 2-1 4-4 0z" {...stroke} />
        </Svg>
      );
    case 'countryToCapital':
      return (
        <Svg testID="geo.glyph.countryToCapital" width={size} height={size} viewBox={VIEWBOX}>
          <Path d="M3 6l4-2 4 2.5-1 5-5 .5z" {...stroke} />
          <Path d="M11 15h7M15 12l3 3-3 3" {...stroke} />
          <Path
            d="M20 5l1 2 2.2.3-1.6 1.5.4 2.2L20 10l-2 1 .4-2.2-1.6-1.5L19 7z"
            fill={ink}
          />
        </Svg>
      );
    case 'cityDistance':
      return (
        <Svg testID="geo.glyph.cityDistance" width={size} height={size} viewBox={VIEWBOX}>
          <Path
            d="M6 3a3.5 3.5 0 0 1 3.5 3.5C9.5 9.2 6 13 6 13S2.5 9.2 2.5 6.5A3.5 3.5 0 0 1 6 3z"
            fill={ink}
          />
          <Path d="M8 17c3 2 8 2 11-1" {...stroke} strokeDasharray="1.5 3" />
          <Circle cx="19.5" cy="15.5" r="2.2" fill={ink} />
        </Svg>
      );
  }
}

/** Sheet close mark (×) and row chevron, stroked like the boards. */
export function CloseGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox={VIEWBOX}>
      <Path d="M6 6l12 12M18 6L6 18" {...strokeOf(color)} />
    </Svg>
  );
}

export function ChevronGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox={VIEWBOX}>
      <Path d="M9 6l6 6-6 6" {...strokeOf(color)} />
    </Svg>
  );
}
