import { StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { companionFoxSvg } from '../../../assets/svg/companionFox';
import { companionL2Svg } from '../../../assets/svg/companionL2';
import { companionL2SilhouetteSvg } from '../../../assets/svg/companionL2Silhouette';
import { companionL3SilhouetteSvg } from '../../../assets/svg/companionL3Silhouette';
import { companionL4Svg } from '../../../assets/svg/companionL4';
import { companionL4SilhouetteSvg } from '../../../assets/svg/companionL4Silhouette';
import { companionL5Svg } from '../../../assets/svg/companionL5';
import { companionL5SilhouetteSvg } from '../../../assets/svg/companionL5Silhouette';
import { companionL6Svg } from '../../../assets/svg/companionL6';
import { companionL6SilhouetteSvg } from '../../../assets/svg/companionL6Silhouette';
import { companionL7Svg } from '../../../assets/svg/companionL7';
import { companionL7SilhouetteSvg } from '../../../assets/svg/companionL7Silhouette';
import { companionPandaSvg } from '../../../assets/svg/companionPanda';
import { shadowColor } from '../../constants/colors';
import { toLevel, type LevelNumber } from './levelMeta';

const SILHOUETTE_OPACITY = 0.35;

const art: Record<LevelNumber, string> = {
  1: companionPandaSvg,
  2: companionL2Svg,
  3: companionFoxSvg,
  4: companionL4Svg,
  5: companionL5Svg,
  6: companionL6Svg,
  7: companionL7Svg,
};

/** Locked art (every colour `currentColor`). Level 1 is never locked, so it has none. */
const silhouettes: Partial<Record<LevelNumber, string>> = {
  2: companionL2SilhouetteSvg,
  3: companionL3SilhouetteSvg,
  4: companionL4SilhouetteSvg,
  5: companionL5SilhouetteSvg,
  6: companionL6SilhouetteSvg,
  7: companionL7SilhouetteSvg,
};

type Props = {
  level: number;
  size: number;
  /** Locked companion: black at 35 %. */
  silhouette?: boolean;
  /** Omit for decorative art that a neighbouring label already describes. */
  accessibilityLabel?: string;
  testID?: string;
};

/** The companion of a level (AC5, AC6), full colour or as a locked silhouette. */
export function CompanionArt({ level, size, silhouette = false, accessibilityLabel, testID }: Props) {
  const n = toLevel(level);
  const locked = silhouette ? silhouettes[n] : undefined;
  return (
    <View
      testID={testID}
      style={locked ? layout.silhouette : undefined}
      accessible={!!accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
    >
      <SvgXml
        xml={locked ?? art[n]}
        width={size}
        height={size}
        color={shadowColor}
        importantForAccessibility="no-hide-descendants"
      />
    </View>
  );
}

const layout = StyleSheet.create({
  silhouette: { opacity: SILHOUETTE_OPACITY },
});
