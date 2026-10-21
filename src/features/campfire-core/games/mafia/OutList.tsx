import { StyleSheet, View } from 'react-native';

import { AppText } from '../../../../shared/components/AppText';
import {
  borders,
  radii,
  sizes,
  spacing,
} from '../../../../shared/constants/spacing';
import { createThemedStyles } from '../../../../shared/contexts/theme';
import { t } from '../../../../shared/i18n';
import { mafiaSizes } from '../../campTheme';
import type {
  MafiaOut,
  MafiaPhase,
  RosterPlayer,
} from '../../protocol/codec';
import { SeatAvatar } from '../components/SeatAvatar';
import { RoleGlyph } from './RoleGlyph';
import { roles, type RoleId } from './roles';

/** "Night 2" / "Day 1". */
export function phaseLabel(phase: MafiaPhase): string {
  return t(phase.kind === 'night' ? 'camp.maf.night' : 'camp.maf.day', {
    n: phase.n,
  });
}

/** "killed · Night 2" / "exiled · Day 1"; a seat that left at night reads "left · Night 1". */
export function fateLabel(entry: Pick<MafiaOut, 'reason' | 'phase'>): string {
  if (entry.reason === 'killed') {
    return t('camp.maf.killed', { n: entry.phase.n });
  }
  return t(
    entry.phase.kind === 'night' ? 'camp.maf.leftNight' : 'camp.maf.exiled',
    { n: entry.phase.n },
  );
}

/** A role's colour chip with its glyph and name. */
export function RoleChip({ roleId }: { roleId: RoleId }) {
  const color = roles.find(role => role.id === roleId)?.color;
  return (
    <View style={[layout.chip, { backgroundColor: color }]}>
      <RoleGlyph roleId={roleId} size={mafiaSizes.chipGlyph} />
      <AppText variant="chip" tone="white">
        {t(`camp.maf.role.${roleId}.name`)}
      </AppText>
    </View>
  );
}

type Props = { out: MafiaOut[]; roster: RosterPlayer[] };

/** Players out of the game (AC5): avatar, nickname, fate and the role when the host reveals it. */
export function OutList({ out, roster }: Props) {
  const styles = useStyles();
  if (out.length === 0) {
    return null;
  }
  return (
    <View style={layout.section}>
      <AppText variant="h3" accessibilityRole="header">
        {t('camp.maf.outTitle')}
      </AppText>
      {out.map(entry => {
        const player = roster.find(seat => seat.seatId === entry.seatId);
        const avatar = entry.player?.avatar ?? player?.avatar;
        const nickname = entry.player?.nickname ?? player?.nickname ?? '';
        return (
          <View
            key={entry.seatId}
            testID={`maf.out.${entry.seatId}`}
            style={[layout.row, styles.row]}
          >
            {avatar ? (
              <SeatAvatar avatar={avatar} size={mafiaSizes.rowAvatar} />
            ) : null}
            <View style={layout.fill}>
              <AppText variant="body">{nickname}</AppText>
              <AppText variant="small">{fateLabel(entry)}</AppText>
            </View>
            {entry.roleId ? <RoleChip roleId={entry.roleId} /> : null}
          </View>
        );
      })}
    </View>
  );
}

const layout = StyleSheet.create({
  section: { gap: spacing[8] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    padding: spacing[12],
    borderRadius: radii.card,
    borderWidth: borders.card,
  },
  fill: { flex: 1 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    minHeight: sizes.chipHeight,
    paddingHorizontal: sizes.chipPaddingHorizontal,
    borderRadius: radii.pill,
  },
});

const useStyles = createThemedStyles(c => ({
  row: { borderColor: c.line, backgroundColor: c.card },
}));
