import { StyleSheet, View } from 'react-native';

import { AppText } from '../../../../shared/components/AppText';
import { Pressable } from '../../../../shared/components/Pressable';
import {
  borders,
  radii,
  sizes,
  spacing,
} from '../../../../shared/constants/spacing';
import { createThemedStyles } from '../../../../shared/contexts/theme';
import { t } from '../../../../shared/i18n';
import { haptics } from '../../../../shared/utils/haptics';
import { partySizes } from '../../campTheme';
import type { RosterPlayer } from '../../protocol/codec';
import { SeatAvatar } from '../components/SeatAvatar';

type Props = {
  roster: RosterPlayer[];
  /** Host only: picks who shows next. Absent on players' phones (they wait). */
  onPick?: (seatId: string) => void;
};

/** Phase `pick` (AC2): the host taps who shows next (host included); everyone else waits. */
export function CrocPick({ roster, onPick }: Props) {
  const styles = useStyles();
  if (!onPick) {
    return (
      <View testID="croc.waiting" style={layout.section}>
        <AppText variant="body" tone="muted" style={layout.center}>
          {t('camp.croc.choosing')}
        </AppText>
      </View>
    );
  }
  const connected = roster.filter(player => player.status === 'connected');
  return (
    <View testID="croc.pick" style={layout.section}>
      <AppText variant="h2" accessibilityRole="header">
        {t('camp.croc.pickTitle')}
      </AppText>
      {connected.map(player => (
        <Pressable
          key={player.seatId}
          testID={`croc.pick.${player.seatId}`}
          accessibilityRole="button"
          accessibilityLabel={player.nickname}
          onPress={() => {
            haptics.tap();
            onPick(player.seatId);
          }}
          style={[layout.row, styles.row]}
        >
          <SeatAvatar avatar={player.avatar} size={partySizes.rowAvatar} />
          <AppText variant="h3" style={layout.flex}>
            {player.nickname}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

const layout = StyleSheet.create({
  section: { gap: spacing[12] },
  center: { textAlign: 'center' },
  flex: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[10],
    borderRadius: radii.tile,
    borderWidth: borders.card,
  },
});

const useStyles = createThemedStyles(c => ({
  row: { backgroundColor: c.card, borderColor: c.line },
}));
