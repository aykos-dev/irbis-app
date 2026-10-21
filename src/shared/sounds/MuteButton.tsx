import { useState } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Pressable } from '../components/Pressable';
import { sizes } from '../constants/spacing';
import { useTheme } from '../contexts/theme';
import { haptics } from '../utils/haptics';
import { sounds } from './sounds';

const SPEAKER_PATH = 'M4 9h4l5-4v14l-5-4H4z';
const WAVES_PATH = 'M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11';
const MUTED_PATH = 'M16 9l5 6M21 9l-5 6';
const VIEWBOX = '0 0 24 24';

type Props = {
  testID: string;
  /** a11y label while sound is on (the action: mute). */
  muteLabel: string;
  /** a11y label while muted (the action: turn sound on). */
  unmuteLabel: string;
};

/** Speaker switch for the shared sound mute (MMKV `lessons.muted`), 44 pt target. */
export function MuteButton({ testID, muteLabel, unmuteLabel }: Props) {
  const { colors } = useTheme();
  const [muted, setMuted] = useState(sounds.muted);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityState={{ checked: !muted }}
      accessibilityLabel={muted ? unmuteLabel : muteLabel}
      onPress={() => {
        haptics.selection();
        setMuted(sounds.toggleMuted());
      }}
      style={layout.button}
    >
      <Svg viewBox={VIEWBOX} width={sizes.icon} height={sizes.icon}>
        <Path d={SPEAKER_PATH} fill={colors.muted} />
        <Path
          d={muted ? MUTED_PATH : WAVES_PATH}
          stroke={colors.muted}
          strokeWidth={sizes.iconStroke}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </Pressable>
  );
}

const layout = StyleSheet.create({
  button: {
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
