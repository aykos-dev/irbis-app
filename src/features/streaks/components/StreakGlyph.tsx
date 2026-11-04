import { StyleSheet, View } from 'react-native';

import { AppText } from '../../../shared/components/AppText';
import { Icon } from '../../../shared/components/Icon';
import { streakColors } from '../../../shared/constants/colors';
import { spacing } from '../../../shared/constants/spacing';
import { useTheme } from '../../../shared/contexts/theme';

const GLYPH = 22;
const BADGE = 12;

type Props = {
  kind: 'flame' | 'boot';
  count: number;
  /** Flame only: orange when lit (done today), grey otherwise. */
  lit?: boolean;
  /** Boot only: blue weather-shield badge. */
  shielded?: boolean;
  shieldTestID?: string;
};

/** A streak glyph with its count; decorative — the holder carries the a11y label. */
export function StreakGlyph({ kind, count, lit = true, shielded = false, shieldTestID }: Props) {
  const { colors } = useTheme();
  const color = kind === 'boot' ? streakColors.boot : lit ? streakColors.flame : colors.stone;
  return (
    <View style={layout.row}>
      <View>
        <Icon name={kind} color={color} size={GLYPH} />
        {shielded ? (
          <View testID={shieldTestID} style={layout.badge}>
            <Icon name="shield" color={streakColors.shield} size={BADGE} />
          </View>
        ) : null}
      </View>
      <AppText variant="h3">{count}</AppText>
    </View>
  );
}

const layout = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  badge: { position: 'absolute', right: -spacing[4], bottom: -spacing[4] },
});
