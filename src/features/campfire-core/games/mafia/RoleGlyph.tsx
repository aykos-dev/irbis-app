import Svg, { Path } from 'react-native-svg';

import { palette } from '../../../../shared/constants/colors';
import { mafiaSizes } from '../../campTheme';
import { roles, type RoleGlyphName, type RoleId } from './roles';

/** 24×24 filled glyphs (design/media/campfire-mafia/MEDIA.md); crosshair, notepad, infinity are placeholders. */
const paths: Record<RoleGlyphName, string> = {
  crown: 'M3 18h18l-1.5-10-4.5 4-3-6-3 6-4.5-4zM3 20h18v2H3z',
  hat: 'M7 4h10v9H7zM2 13h20v3H2z',
  glass:
    'M10 3a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm0 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM15 15l2-2 5 5-2 2z',
  cross: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
  moon: 'M14 3a9 9 0 1 0 7 13A7 7 0 0 1 14 3z',
  heart:
    'M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z',
  shield: 'M12 2l8 3v6.2c0 5-3.4 9-8 10.8-4.6-1.8-8-5.8-8-10.8V5z',
  crosshair:
    'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zm0 2.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM11 1h2v7h-2zM11 16h2v7h-2zM1 11h7v2H1zM16 11h7v2h-7z',
  notepad: 'M5 2h14v20H5zM8 7h8v2H8zM8 11h8v2H8zM8 15h5v2H8z',
  infinity:
    'M7 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM17 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  person:
    'M12 3a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zM4 21c.6-4.4 3.8-6.5 8-6.5s7.4 2.1 8 6.5z',
};

type Props = {
  roleId: RoleId;
  size?: number;
  color?: string;
};

/** A role's glyph, white by default (drawn on the role colour tile). */
export function RoleGlyph({
  roleId,
  size = mafiaSizes.roleGlyph,
  color = palette.white,
}: Props) {
  const glyph = roles.find(role => role.id === roleId)?.glyph ?? 'person';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={paths[glyph]}
        fill={color}
        fillRule={glyph === 'notepad' ? 'evenodd' : 'nonzero'}
      />
    </Svg>
  );
}
