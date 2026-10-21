import { StyleSheet, View } from 'react-native';

import { AppText } from '../../../../shared/components/AppText';
import { borders, radii, spacing } from '../../../../shared/constants/spacing';
import { createThemedStyles } from '../../../../shared/contexts/theme';
import { t } from '../../../../shared/i18n';
import { xoSizes } from '../../campTheme';
import type { RosterPlayer, XoPublic } from '../../protocol/codec';
import { SeatAvatar } from '../components/SeatAvatar';
import { MarkIcon } from './MarkIcon';

type Props = {
  info: XoPublic;
  roster: RosterPlayer[];
};

/** The 2 players in roster order (host first), so the sides stay put when the marks swap. */
export function seriesSeats(info: XoPublic, roster: RosterPlayer[]): string[] {
  const order = (seatId: string) => {
    const at = roster.findIndex(player => player.seatId === seatId);
    return at < 0 ? roster.length : at;
  };
  return Object.keys(info.score).sort((a, b) => order(a) - order(b));
}

/** Series score (AC5): each player's avatar, name, current mark and wins; the draws in the middle. */
export function XoScoreBar({ info, roster }: Props) {
  const styles = useStyles();
  const [left, right] = seriesSeats(info, roster);

  const side = (seatId: string | undefined) => {
    if (!seatId) {
      return <View style={layout.side} />;
    }
    const player = roster.find(seat => seat.seatId === seatId);
    const mark = seatId === info.xSeatId ? 'x' : 'o';
    const wins = info.score[seatId] ?? 0;
    return (
      <View
        testID={`xo.score.${seatId}`}
        style={layout.side}
        accessible
        accessibilityLabel={`${player?.nickname ?? ''} ${mark.toUpperCase()} ${wins}`}
      >
        {player ? (
          <SeatAvatar avatar={player.avatar} size={xoSizes.scoreAvatar} />
        ) : null}
        <AppText variant="small" numberOfLines={1}>
          {player?.nickname ?? ''}
        </AppText>
        <View style={layout.markRow}>
          <MarkIcon mark={mark} />
          <AppText variant="h2">{wins}</AppText>
        </View>
      </View>
    );
  };

  return (
    <View style={[layout.bar, styles.bar]}>
      {side(left)}
      <AppText testID="xo.draws" variant="small" tone="muted" style={layout.draws}>
        {t('camp.xo.draws', { d: info.draws })}
      </AppText>
      {side(right)}
    </View>
  );
}

const layout = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[8],
    padding: spacing[12],
    borderRadius: radii.card,
    borderWidth: borders.card,
  },
  side: { flex: 1, alignItems: 'center', gap: spacing[4] },
  markRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[6] },
  draws: { textAlign: 'center' },
});

const useStyles = createThemedStyles(c => ({
  bar: { borderColor: c.line, backgroundColor: c.card },
}));
