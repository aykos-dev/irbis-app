import Svg, { Circle, Path } from 'react-native-svg';

import { xoColors, xoSizes } from '../../campTheme';
import type { XoMark } from '../../protocol/codec';

/** Small static mark (turn line, score bar); decorative: the text next to it carries the label. */
export function MarkIcon({ mark }: { mark: XoMark }) {
  const size = xoSizes.headerMark;
  const common = {
    stroke: xoColors[mark],
    strokeWidth: xoSizes.markStroke,
    strokeLinecap: 'round' as const,
    fill: 'none',
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {mark === 'x' ? (
        <Path d="M20 20L80 80M80 20L20 80" {...common} />
      ) : (
        <Circle cx="50" cy="50" r="32" {...common} />
      )}
    </Svg>
  );
}
