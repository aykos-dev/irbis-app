import Svg, { Circle, Path } from 'react-native-svg';

import { palette } from '../../constants/colors';
import { sizes } from '../../constants/spacing';

export type WeatherKind = 'sun' | 'cloud' | 'rain' | 'snow' | 'storm';

const SIZE = sizes.iconTile;
const VIEWBOX = '0 0 24 24';

function inRange(code: number, from: number, to: number): boolean {
  return code >= from && code <= to;
}

/** WMO weather code → glyph (AC7). Unknown codes read as cloud. */
export function weatherKind(code: number): WeatherKind {
  if (inRange(code, 0, 1)) {
    return 'sun';
  }
  if (inRange(code, 51, 67) || inRange(code, 80, 82)) {
    return 'rain';
  }
  if (inRange(code, 71, 77) || inRange(code, 85, 86)) {
    return 'snow';
  }
  if (inRange(code, 95, 99)) {
    return 'storm';
  }
  return 'cloud';
}

const CLOUD = 'M7 17 H17 A4 4 0 0 0 16.2 9.1 A5.5 5.5 0 0 0 5.6 10.6 A3.3 3.3 0 0 0 7 17 Z';

/** Placeholder glyphs (owner art later): simple strokes in palette colours. */
export function WeatherGlyph({ code, testID }: { code: number; testID?: string }) {
  const kind = weatherKind(code);
  const stroke = {
    strokeWidth: sizes.iconStroke,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };
  return (
    <Svg
      width={SIZE}
      height={SIZE}
      viewBox={VIEWBOX}
      testID={testID}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {kind === 'sun' ? (
        <>
          <Circle cx="12" cy="12" r="4.5" stroke={palette.gold} {...stroke} />
          <Path
            d="M12 2.5 V4.5 M12 19.5 V21.5 M2.5 12 H4.5 M19.5 12 H21.5 M5.3 5.3 L6.7 6.7 M17.3 17.3 L18.7 18.7 M5.3 18.7 L6.7 17.3 M17.3 6.7 L18.7 5.3"
            stroke={palette.gold}
            {...stroke}
          />
        </>
      ) : (
        <Path d={CLOUD} stroke={palette.stone} {...stroke} />
      )}
      {kind === 'rain' ? (
        <Path d="M8.5 19.5 L7.5 22 M12.5 19.5 L11.5 22 M16.5 19.5 L15.5 22" stroke={palette.sky} {...stroke} />
      ) : null}
      {kind === 'snow' ? (
        <Path d="M8 20.5 V20.6 M12 21 V21.1 M16 20.5 V20.6" stroke={palette.sky} {...stroke} />
      ) : null}
      {kind === 'storm' ? (
        <Path d="M12.5 17 L10.5 20.5 H13.5 L11.5 23" stroke={palette.gold} {...stroke} />
      ) : null}
    </Svg>
  );
}
