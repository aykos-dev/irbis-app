import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '../../../../shared/components/AppText';
import { Pressable } from '../../../../shared/components/Pressable';
import { borders, motion, radii, sizes, spacing } from '../../../../shared/constants/spacing';
import { createThemedStyles } from '../../../../shared/contexts/theme';
import { t } from '../../../../shared/i18n';
import { partySizes } from '../../campTheme';
import type { RosterPlayer, WyrPick } from '../../protocol/codec';
import { SeatAvatar } from '../components/SeatAvatar';

type Props = {
  pick: WyrPick;
  text: string;
  selected: boolean;
  /** Tapping picks this option (until the reveal, and only for players dealt into the round). */
  onPress?: () => void;
  /** After the reveal: this option's share (0–1) and who picked it. */
  result: { share: number; voters: RosterPlayer[] } | null;
};

/** One "Would you rather" option card; after the reveal its bar grows to the share, voters below. */
export function VoteOption({ pick, text, selected, onPress, result }: Props) {
  const styles = useStyles();
  return (
    <Pressable
      testID={`wyr.option.${pick}`}
      accessibilityRole="button"
      accessibilityLabel={text}
      accessibilityState={{ selected }}
      disabled={!onPress}
      onPress={onPress}
      style={[layout.card, styles.card, selected && styles.selected]}
    >
      <AppText variant="h3">{text}</AppText>
      {selected && result ? (
        <View style={[layout.tag, styles.tag]}>
          <AppText variant="chip" tone="onOrange">
            {t('camp.wyr.yourPick')}
          </AppText>
        </View>
      ) : null}
      {result ? <Result share={result.share} voters={result.voters} /> : null}
    </Pressable>
  );
}

function Result({ share, voters }: { share: number; voters: RosterPlayer[] }) {
  const styles = useStyles();
  const width = useSharedValue(0);
  useEffect(() => {
    width.value = withTiming(share, { duration: partySizes.revealMs });
  }, [share, width]);
  const bar = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));

  return (
    <View style={layout.result}>
      <View style={layout.barRow}>
        <View style={[layout.track, styles.track]}>
          <Animated.View style={[layout.bar, styles.bar, bar]} />
        </View>
        <AppText variant="chip">{`${Math.round(share * 100)}%`}</AppText>
      </View>
      <View style={layout.voters}>
        {voters.map((voter, index) => (
          <Animated.View
            key={voter.seatId}
            entering={FadeInDown.delay(
              partySizes.revealMs + index * motion.listStagger,
            )}
          >
            <SeatAvatar avatar={voter.avatar} size={partySizes.voterAvatar} />
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

const layout = StyleSheet.create({
  card: {
    padding: spacing[16],
    gap: spacing[10],
    borderRadius: radii.card,
    borderWidth: borders.card,
    borderBottomWidth: borders.edge,
  },
  tag: {
    alignSelf: 'flex-start',
    minHeight: sizes.chipHeight,
    paddingHorizontal: sizes.chipPaddingHorizontal,
    borderRadius: radii.pill,
    justifyContent: 'center',
  },
  result: { gap: spacing[8] },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[8] },
  track: {
    flex: 1,
    height: partySizes.barHeight,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  bar: { height: '100%', borderRadius: radii.pill },
  voters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[4] },
});

const useStyles = createThemedStyles(c => ({
  card: { backgroundColor: c.card, borderColor: c.line },
  selected: { borderColor: c.orange },
  tag: { backgroundColor: c.orange },
  track: { backgroundColor: c.soft },
  bar: { backgroundColor: c.orange },
}));
