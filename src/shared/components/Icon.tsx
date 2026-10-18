import Svg, { Circle, Path } from 'react-native-svg';

import { sizes } from '../constants/spacing';

/**
 * Inline SVG icons, drawn from the canvas boards (Nav, AccLogin, AccSignup, AccGate,
 * AccGuestProfile). Every icon is decorative: the control that holds it carries the label.
 * Geometry is artwork; colour and size come from the caller's tokens.
 */
export type IconName =
  | 'path'
  | 'explore'
  | 'lessons'
  | 'community'
  | 'back'
  | 'eye'
  | 'eyeOff'
  | 'checkCircle'
  | 'check'
  | 'info'
  | 'globe'
  | 'shield'
  | 'star'
  | 'person'
  | 'phone'
  | 'chevron'
  | 'lock'
  /** Level requirement rows (canvas Level): XP and safety lessons. */
  | 'bolt'
  | 'cross'
  /** Place-type glyphs — placeholders (owner Q8) until the owner supplies final icons. */
  | 'waterfall'
  | 'canyon';

type Props = {
  name: IconName;
  color: string;
  size?: number;
  /** Second colour for icons with a filled disc (check circle: tick colour). */
  accent?: string;
};

const STROKE = { strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export function Icon({ name, color, size = sizes.icon, accent }: Props) {
  return (
    <Svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {draw(name, color, accent ?? color)}
    </Svg>
  );
}

function draw(name: IconName, color: string, accent: string) {
  switch (name) {
    case 'path':
      return (
        <>
          <Path
            d="M6 21c0-4.5 12-3.5 12-8.5S6 8.5 6 4"
            fill="none"
            stroke={color}
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeDasharray="0.1 4.4"
          />
          <Circle cx={6} cy={21} r={2.4} fill={color} />
          <Circle cx={6} cy={3.6} r={2.4} fill={color} />
        </>
      );
    case 'explore':
      return (
        <Path
          d="M3 6.5l6-3 6 3 6-3V18l-6 3-6-3-6 3zM9 3.5V18M15 6.5V21"
          fill="none"
          stroke={color}
          strokeWidth={2.4}
          strokeLinejoin="round"
        />
      );
    case 'lessons':
      return (
        <Path
          d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5M9 8h7"
          fill="none"
          stroke={color}
          strokeWidth={2.4}
          {...STROKE}
        />
      );
    case 'community':
      return (
        <>
          <Circle cx={9} cy={8} r={3.6} fill={color} />
          <Path d="M2 20.5c.4-4.4 3.2-6.6 7-6.6s6.6 2.2 7 6.6z" fill={color} />
          <Circle cx={17.5} cy={9} r={2.7} fill={color} opacity={0.6} />
          <Path d="M17 13.6c2.9 0 4.6 2 5 5.4h-4.2" fill={color} opacity={0.6} />
        </>
      );
    case 'back':
      return <Path d="M15 5l-7 7 7 7" fill="none" stroke={color} strokeWidth={3} {...STROKE} />;
    case 'chevron':
      return <Path d="M9 5l7 7-7 7" fill="none" stroke={color} strokeWidth={3} {...STROKE} />;
    case 'eye':
      return (
        <>
          <Path
            d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"
            fill="none"
            stroke={color}
            strokeWidth={2.2}
            strokeLinejoin="round"
          />
          <Circle cx={12} cy={12} r={3} fill="none" stroke={color} strokeWidth={2.2} />
        </>
      );
    case 'eyeOff':
      return (
        <>
          <Path
            d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"
            fill="none"
            stroke={color}
            strokeWidth={2.2}
            strokeLinejoin="round"
          />
          <Circle cx={12} cy={12} r={3} fill="none" stroke={color} strokeWidth={2.2} />
          <Path d="M4 4l16 16" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
        </>
      );
    case 'checkCircle':
      return (
        <>
          <Circle cx={12} cy={12} r={10} fill={color} />
          <Path
            d="M7.5 12.5l3 3 6-6.5"
            fill="none"
            stroke={accent}
            strokeWidth={2.6}
            {...STROKE}
          />
        </>
      );
    case 'check':
      return <Path d="M6 12.5l4 4 8-9" fill="none" stroke={color} strokeWidth={3} {...STROKE} />;
    case 'info':
      return (
        <>
          <Circle cx={12} cy={12} r={9.5} fill="none" stroke={color} strokeWidth={2.2} />
          <Path d="M12 11v5.5M12 7.6v.2" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" />
        </>
      );
    case 'globe':
      return (
        <>
          <Circle cx={12} cy={12} r={9} fill="none" stroke={color} strokeWidth={2.2} />
          <Path
            d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"
            fill="none"
            stroke={color}
            strokeWidth={2.2}
          />
        </>
      );
    case 'shield':
      return <Path d="M12 2l8 3v6.2c0 5-3.4 9-8 10.8-4.6-1.8-8-5.8-8-10.8V5z" fill={color} />;
    case 'star':
      return <Path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z" fill={color} />;
    case 'person':
      return (
        <>
          <Circle cx={9} cy={8} r={3.6} fill={color} />
          <Path d="M2 20.5c.4-4.4 3.2-6.6 7-6.6s6.6 2.2 7 6.6z" fill={color} />
        </>
      );
    case 'lock':
      return (
        <>
          <Path d="M5 11h14v10H5z" fill="none" stroke={color} strokeWidth={2.4} {...STROKE} />
          <Path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke={color} strokeWidth={2.4} {...STROKE} />
        </>
      );
    case 'bolt':
      return <Path d="M13.5 2L4.5 13.5h6L9.5 22l9-11.5h-6z" fill={color} />;
    case 'cross':
      return <Path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" fill={color} />;
    case 'waterfall':
      return (
        <>
          <Path d="M3 4h18v4H3z" fill={color} />
          <Path d="M7 8v9M12 8v11M17 8v9" fill="none" stroke={color} strokeWidth={2.4} {...STROKE} />
          <Path d="M3 21c3-2 15-2 18 0" fill="none" stroke={color} strokeWidth={2.4} {...STROKE} />
        </>
      );
    case 'canyon':
      return <Path d="M1.5 4H8l2 6 2 10H1.5zM22.5 4H16l-2 6-2 10h10.5z" fill={color} />;
    case 'phone':
      return (
        <Path
          d="M6.5 3h3l1.5 4.5-2 1.3a11 11 0 0 0 5.2 5.2l1.3-2 4.5 1.5v3a2.5 2.5 0 0 1-2.7 2.5A15.5 15.5 0 0 1 4 5.7 2.5 2.5 0 0 1 6.5 3z"
          fill="none"
          stroke={color}
          strokeWidth={2.2}
          strokeLinejoin="round"
        />
      );
  }
}
