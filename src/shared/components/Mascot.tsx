import { SvgXml } from 'react-native-svg';

import { companionFoxSvg } from '../../assets/svg/companionFox';
import { companionPandaSvg } from '../../assets/svg/companionPanda';
import { irbisDefaultSvg } from '../../assets/svg/irbisDefault';
import { irbisExcitedSvg } from '../../assets/svg/irbisExcited';
import { irbisProudSvg } from '../../assets/svg/irbisProud';
import { irbisSleepySvg } from '../../assets/svg/irbisSleepy';
import { irbisWorriedSvg } from '../../assets/svg/irbisWorried';

/** Canvas mascot and companion art (irbis-docs/design/assets.md), final per owner (Q10). */
const artwork = {
  default: irbisDefaultSvg,
  excited: irbisExcitedSvg,
  proud: irbisProudSvg,
  worried: irbisWorriedSvg,
  sleepy: irbisSleepySvg,
  panda: companionPandaSvg,
  fox: companionFoxSvg,
} as const;

export type MascotKind = keyof typeof artwork;

type Props = {
  kind: MascotKind;
  size: number;
  /** Omit for decorative art that a neighbouring label already describes. */
  accessibilityLabel?: string;
  testID?: string;
};

export function Mascot({ kind, size, accessibilityLabel, testID }: Props) {
  return (
    <SvgXml
      xml={artwork[kind]}
      width={size}
      height={size}
      testID={testID}
      accessible={!!accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
    />
  );
}
