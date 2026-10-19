import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '../../../../shared/components/AppButton';
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
import { mafiaSizes } from '../../campTheme';
import type { RosterPlayer } from '../../protocol/codec';
import { SeatAvatar } from '../components/SeatAvatar';
import type { MafiaState } from '../gameReducer';
import { fateLabel, phaseLabel, RoleChip } from './OutList';
import { PlayerSheet } from './PlayerSheet';
import { teamOf, type Team } from './roles';

type Props = {
  game: MafiaState;
  roster: RosterPlayer[];
  onPhaseNext: () => void;
  onMarkOut: (seatId: string) => void;
  onMarkBack: (seatId: string) => void;
};

/**
 * The narrator's screen (AC4): phase, alive counts by team, every player with their role and
 * status (ready ticks during Night 1), a sheet to mark a player out or back, and the phase button.
 */
export function HostControl({
  game,
  roster,
  onPhaseNext,
  onMarkOut,
  onMarkBack,
}: Props) {
  const styles = useStyles();
  const [picked, setPicked] = useState<string | null>(null);
  const { phase } = game;
  const outOf = (seatId: string) =>
    game.out.find(entry => entry.seatId === seatId);
  const alive = game.players.filter(seatId => !outOf(seatId));
  const teams: Record<Team, number> = { mafia: 0, town: 0, solo: 0 };
  alive.forEach(seatId => {
    const roleId = game.deals[seatId]?.roleId;
    if (roleId) {
      teams[teamOf(roleId)] += 1;
    }
  });
  const firstNight = phase.kind === 'night' && phase.n === 1;
  const nameOf = (seatId: string) =>
    roster.find(player => player.seatId === seatId)?.nickname ?? '';
  const pickedOut = picked ? outOf(picked) : undefined;

  const close = () => setPicked(null);

  return (
    <View testID="maf.host" style={layout.root}>
      <View style={layout.header}>
        <AppText variant="h1" accessibilityRole="header">
          {t('camp.maf.narrator')}
        </AppText>
        <AppText variant="h3">{phaseLabel(phase)}</AppText>
        <AppText variant="small">
          {t('camp.maf.hostLine', {
            a: alive.length,
            n: game.players.length,
            ...teams,
          })}
        </AppText>
      </View>

      <View style={layout.list}>
        {game.players.map(seatId => {
          const player = roster.find(seat => seat.seatId === seatId);
          const roleId = game.deals[seatId]?.roleId;
          const out = outOf(seatId);
          const name = nameOf(seatId);
          return (
            <Pressable
              key={seatId}
              testID={`maf.player.${seatId}`}
              accessibilityRole="button"
              accessibilityLabel={name}
              onPress={() => {
                haptics.tap();
                setPicked(seatId);
              }}
              style={[layout.row, styles.row]}
            >
              {player ? (
                <SeatAvatar avatar={player.avatar} size={mafiaSizes.rowAvatar} />
              ) : null}
              <View style={layout.fill}>
                <AppText variant="body">{name}</AppText>
                <AppText variant="small" tone={out ? 'red700' : 'muted'}>
                  {out ? fateLabel(out) : t('camp.maf.alive')}
                </AppText>
              </View>
              {firstNight && game.ready.includes(seatId) ? (
                <View style={[layout.tick, styles.tick]}>
                  <AppText variant="chip" tone="teal700">
                    {t('camp.maf.readyTick')}
                  </AppText>
                </View>
              ) : null}
              {roleId ? <RoleChip roleId={roleId} /> : null}
            </Pressable>
          );
        })}
      </View>

      <AppButton
        testID="maf.phase-next"
        label={
          phase.kind === 'night'
            ? t('camp.maf.startDay', { n: phase.n })
            : t('camp.maf.startNight', { n: phase.n + 1 })
        }
        onPress={() => {
          haptics.tap();
          onPhaseNext();
        }}
      />

      {picked ? (
        <PlayerSheet
          nickname={nameOf(picked)}
          phase={phase}
          out={pickedOut !== undefined}
          onMarkOut={() => {
            haptics.warning();
            onMarkOut(picked);
            close();
          }}
          onMarkBack={() => {
            haptics.success();
            onMarkBack(picked);
            close();
          }}
          onDismiss={close}
        />
      ) : null}
    </View>
  );
}

const layout = StyleSheet.create({
  root: { gap: spacing[20] },
  header: { gap: spacing[6] },
  list: { gap: spacing[8] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    padding: spacing[12],
    borderRadius: radii.card,
    borderWidth: borders.card,
  },
  fill: { flex: 1 },
  tick: {
    minHeight: sizes.chipHeight,
    paddingHorizontal: sizes.chipPaddingHorizontal,
    borderRadius: radii.pill,
    borderWidth: borders.card,
    justifyContent: 'center',
  },
});

const useStyles = createThemedStyles(c => ({
  row: { borderColor: c.line, backgroundColor: c.card },
  tick: { borderColor: c.line, backgroundColor: c.soft },
}));
