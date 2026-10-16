import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { conditionColors } from '../constants/colors';
import { radii, sizes, spacing } from '../constants/spacing';
import { AppText } from './AppText';

/** Condition status — always colour + icon + label (design.md, Condition status). */
export type StatusChipVariant = 'go' | 'caution' | 'notNow' | 'seasonalLock';

type Props = {
  variant: StatusChipVariant;
  label: string;
  testID: string;
};

const ICON = sizes.icon;
const VIEWBOX = `0 0 ${ICON} ${ICON}`;

function ChipIcon({ variant, color }: { variant: StatusChipVariant; color: string }) {
  const stroke = {
    stroke: color,
    strokeWidth: sizes.iconStroke,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };
  switch (variant) {
    case 'go':
      return (
        <Svg width={ICON} height={ICON} viewBox={VIEWBOX}>
          <Path d="M4.5 10.5 L8.5 14.5 L15.5 6" {...stroke} />
        </Svg>
      );
    case 'caution':
      return (
        <Svg width={ICON} height={ICON} viewBox={VIEWBOX}>
          <Path d="M10 3 L18 17 H2 Z" {...stroke} />
          <Path d="M10 8.5 V11.5 M10 14.5 V14.6" {...stroke} />
        </Svg>
      );
    case 'notNow':
      return (
        <Svg width={ICON} height={ICON} viewBox={VIEWBOX}>
          <Circle cx="10" cy="10" r="7.5" {...stroke} />
          <Path d="M7.2 7.2 L12.8 12.8 M12.8 7.2 L7.2 12.8" {...stroke} />
        </Svg>
      );
    case 'seasonalLock':
      return (
        <Svg width={ICON} height={ICON} viewBox={VIEWBOX}>
          <Rect x="4" y="9" width="12" height="8.5" rx="2" {...stroke} />
          <Path d="M6.5 9 V6.5 A3.5 3.5 0 0 1 13.5 6.5 V9" {...stroke} />
        </Svg>
      );
  }
}

export function StatusChip({ variant, label, testID }: Props) {
  const tone = conditionColors[variant];
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={label}
      style={[styles.chip, { backgroundColor: tone.chipBg }]}
    >
      <ChipIcon variant={variant} color={tone.chipFg} />
      <AppText variant="chip" style={{ color: tone.chipFg }}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing[6],
    minHeight: sizes.chipHeight,
    paddingHorizontal: sizes.chipPaddingHorizontal,
    borderRadius: radii.pill,
  },
});
