import { SvgXml } from 'react-native-svg';

import { irbisDefaultSvg } from '../../assets/svg/irbisDefault';

type Props = {
  size: number;
  accessibilityLabel: string;
  testID?: string;
};

/** Irbis, default mood (canvas asset 9ebec15f…). Other moods arrive with their features. */
export function IrbisMascot({ size, accessibilityLabel, testID }: Props) {
  return (
    <SvgXml
      xml={irbisDefaultSvg}
      width={size}
      height={size}
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    />
  );
}
