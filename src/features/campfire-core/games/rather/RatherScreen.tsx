import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '../../../../shared/components/AppButton';
import { AppText } from '../../../../shared/components/AppText';
import { borders, radii, sizes, spacing } from '../../../../shared/constants/spacing';
import { createThemedStyles } from '../../../../shared/contexts/theme';
import { t } from '../../../../shared/i18n';
import { haptics } from '../../../../shared/utils/haptics';
import type {
  GamePhase,
  PublicGame,
  RosterPlayer,
  WyrPick,
} from '../../protocol/codec';
import { findPack, localized } from '../packs';
import { VoteOption } from './VoteOption';

type Props = {
  phase: GamePhase;
  info: PublicGame;
  selfSeatId: string | null;
  roster: RosterPlayer[];
  /** This phone is dealt into the round (a mid-round joiner only watches). */
  canVote: boolean;
  onVote: (pick: WyrPick) => void;
  /** Host phone: Reveal, Next question, New round. */
  host?: { onReveal: () => void; onNext: () => void; onNewRound: () => void };
};

const picks: WyrPick[] = ['a', 'b'];

/**
 * One "Would you rather" question (AC7). Only the vote count shows until the reveal; then the bars,
 * the voters, "Your pick" and the defend line. Mount it with a key per question so the pick resets.
 */
export function RatherScreen({
  phase,
  info,
  selfSeatId,
  roster,
  canVote,
  onVote,
  host,
}: Props) {
  const styles = useStyles();
  const [pick, setPick] = useState<WyrPick | null>(null);
  const revealed = phase === 'revealed' && info.picks !== undefined;
  const pack = findPack(info.packId);
  const question =
    pack && pack.game === 'rather'
      ? pack.items.find(item => item.id === info.questionId)
      : undefined;
  const qIndex = info.qIndex ?? 0;
  const last = qIndex + 1 >= (info.total ?? 0);
  const playerOf = (seatId: string) =>
    roster.find(player => player.seatId === seatId);
  const connected = info.players.filter(
    seatId => playerOf(seatId)?.status === 'connected',
  ).length;
  const votes = info.picks ?? {};
  const mine = revealed && selfSeatId ? votes[selfSeatId] ?? null : pick;
  const votersOf = (side: WyrPick) =>
    Object.entries(votes)
      .filter(([, value]) => value === side)
      .flatMap(([seatId]) => {
        const player = playerOf(seatId);
        return player ? [player] : [];
      });
  const total = Object.keys(votes).length;
  const tally = info.tally ?? { a: 0, b: 0 };
  const minority: WyrPick | null =
    tally.a === tally.b || Math.min(tally.a, tally.b) === 0
      ? null
      : tally.a < tally.b
        ? 'a'
        : 'b';

  useEffect(() => {
    if (revealed) {
      haptics.heavy();
    }
  }, [revealed]);

  const choose = (side: WyrPick) => {
    haptics.selection();
    setPick(side);
    onVote(side);
  };

  return (
    <View testID="wyr.screen" style={layout.root}>
      <View style={layout.header}>
        <AppText variant="h1" accessibilityRole="header">
          {t('camp.wyr.title')}
        </AppText>
        <AppText variant="caption">
          {t('camp.wyr.subLine', {
            pack: pack ? localized(pack.name) : '',
            i: qIndex + 1,
          })}
        </AppText>
        <View testID="wyr.voted" style={[layout.chip, styles.chip]}>
          <AppText variant="chip">
            {t('camp.wyr.voted', { n: info.voted?.length ?? 0, m: connected })}
          </AppText>
        </View>
      </View>

      <AppText variant="h3">{t('camp.wyr.ask')}</AppText>
      {picks.map((side, index) => (
        <View key={side} style={layout.section}>
          {index > 0 ? (
            <AppText variant="h3" tone="muted" style={layout.center}>
              {t('camp.wyr.or')}
            </AppText>
          ) : null}
          <VoteOption
            pick={side}
            text={question ? localized(question[side]) : ''}
            selected={mine === side}
            onPress={canVote && !revealed ? () => choose(side) : undefined}
            result={
              revealed
                ? {
                    share: total > 0 ? tally[side] / total : 0,
                    voters: votersOf(side),
                  }
                : null
            }
          />
        </View>
      ))}

      {revealed && minority ? (
        <AppText testID="wyr.defend" variant="h3" style={layout.center}>
          {t('camp.wyr.defend', {
            names: votersOf(minority)
              .map(player => player.nickname)
              .join(', '),
          })}
        </AppText>
      ) : null}
      {revealed && last ? (
        <AppText testID="wyr.done" variant="h3" style={layout.center}>
          {t('camp.wyr.done')}
        </AppText>
      ) : null}

      {host ? (
        <View style={layout.section}>
          {revealed ? null : (
            <AppButton
              testID="wyr.reveal"
              label={t('camp.wyr.reveal')}
              variant="secondary"
              onPress={host.onReveal}
            />
          )}
          {revealed && !last ? (
            <AppButton
              testID="wyr.next"
              label={t('camp.wyr.next')}
              onPress={host.onNext}
            />
          ) : null}
          {revealed && last ? (
            <AppButton
              testID="wyr.new-round"
              label={t('camp.wyr.newRound')}
              onPress={host.onNewRound}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const layout = StyleSheet.create({
  root: { gap: spacing[16] },
  header: { gap: spacing[6], alignItems: 'flex-start' },
  chip: {
    minHeight: sizes.chipHeight,
    paddingHorizontal: sizes.chipPaddingHorizontal,
    borderRadius: radii.pill,
    borderWidth: borders.card,
    justifyContent: 'center',
  },
  section: { gap: spacing[8] },
  center: { textAlign: 'center' },
});

const useStyles = createThemedStyles(c => ({
  chip: { borderColor: c.line, backgroundColor: c.card },
}));
