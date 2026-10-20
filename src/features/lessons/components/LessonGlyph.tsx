import type { ReactNode } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import type { LessonIcon } from '../../../shared/api/generated/model';

const STROKE = { strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** Lesson glyphs (24 × 24 line art from LAYOUT.md). Decorative: the node carries the label. */
function shapes(icon: LessonIcon): ReactNode {
  switch (icon) {
    case 'compass':
      return (
        <>
          <Circle cx={12} cy={12} r={9} />
          <Path d="M15.5 8.5 13.5 13.5 8.5 15.5 10.5 10.5Z" />
        </>
      );
    case 'leaf':
      return <Path d="M5 19C5 10 10 5 19 5c0 9-5 14-14 14Z M5 19 13 11" />;
    case 'padlock':
      return (
        <>
          <Rect x={5} y={11} width={14} height={10} rx={2} />
          <Path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </>
      );
    case 'cloud':
      return <Path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9.5 4.3 4.3 0 0 0 7 18Z" />;
    case 'paw':
      return (
        <>
          <Circle cx={7} cy={9} r={1.8} />
          <Circle cx={10.5} cy={5.5} r={1.8} />
          <Circle cx={14.5} cy={5.5} r={1.8} />
          <Circle cx={18} cy={9} r={1.8} />
          <Path d="M12 11c-3 0-5.5 3.5-5.5 6a2.5 2.5 0 0 0 3.5 2.3 5 5 0 0 1 4 0A2.5 2.5 0 0 0 17.5 17c0-2.5-2.5-6-5.5-6Z" />
        </>
      );
    case 'first-aid':
      return (
        <>
          <Rect x={3} y={6} width={18} height={14} rx={2} />
          <Path d="M9 6V4h6v2M12 10v6M9 13h6" />
        </>
      );
    case 'mountain':
      return <Path d="M2 20 9 7l4 7 2-3 7 9Z" />;
    case 'waves':
      return <Path d="M2 9c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0M2 15c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0" />;
    case 'avalanche':
      return (
        <>
          <Path d="M2 20 10 6l10 14Z" />
          <Circle cx={16} cy={8} r={1.5} />
          <Circle cx={19} cy={12} r={1.5} />
        </>
      );
    case 'bolt':
      return <Path d="M13 2 4 14h7l-1 8 9-12h-7Z" />;
  }
}

type Props = { icon: LessonIcon; color: string; size: number };

export function LessonGlyph({ icon, color, size }: Props) {
  return (
    <Svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={2}
      {...STROKE}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {shapes(icon)}
    </Svg>
  );
}
