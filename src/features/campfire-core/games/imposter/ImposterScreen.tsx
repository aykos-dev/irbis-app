import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '../../../../shared/components/AppButton';
import { AppText } from '../../../../shared/components/AppText';
import { IrbisMascot } from '../../../../shared/components/IrbisMascot';
import { borders, radii, sizes, spacing } from '../../../../shared/constants/spacing';
import { createThemedStyles } from '../../../../shared/contexts/theme';
import { t } from '../../../../shared/i18n';
import { secretSizes } from '../../campTheme';
import type {
  GamePhase,
  ImposterSecret as Secret,
  PublicGame,
  RosterPlayer,
} from '../../protocol/codec';
import { SecretCard } from '../components/SecretCard';
import { findPack, localized } from '../packs';
import { useSecureScreen } from '../useSecureScreen';
import { ImposterExplainer, ImposterSecret } from './ImposterSecret';
import { WordSecret } from './WordSecret';

type Props = {
  round: number;
  phase: GamePhase;
  info: PublicGame;
  /** This phone's card; null when it waits for the next round. */
  secret: Secret | null;
  selfSeatId: string | null;
  roster: RosterPlayer[];
  /** Host phone: Reveal / New round instead of "the host starts the next round". */
  host?: { onReveal: () => void; onNewRound: () => void };
};

/** Imposter round on every phone (AC4, AC5): header, the held card, clue order, host controls. */
export function ImposterScreen({
  round,
  phase,
  info,
  secret,
  selfSeatId,
  roster,
  host,
}: Props) {
  const styles = useStyles();
  const { captured } = useSecureScreen();
  const pack = findPack(info.packId);
  const category = pack ? localized(pack.name) : '';
  const wordOf = (wordId: string | undefined) => {
    const item =
      pack && pack.game !== 'rather'
        ? pack.items.find(entry => entry.id === wordId)
        : undefined;
    return item ? localized(item) : '';
  };
  const nameOf = (seatId: string) =>
    roster.find(player => player.seatId === seatId)?.nickname ?? null;
  const hostName = roster.find(player => player.host)?.nickname ?? '';
  const order = (info.order ?? info.players)
    .filter(seatId => info.players.includes(seatId))
    .map(seatId => ({
      seatId,
      name: seatId === selfSeatId ? t('camp.imp.you') : nameOf(seatId),
    }))
    .filter((entry): entry is { seatId: string; name: string } => entry.name !== null);
  const imposterNames = (info.imposterSeatIds ?? [])
    .map(nameOf)
    .filter((name): name is string => name !== null);

  return (
    <View testID="imp.screen" style={layout.root}>
      <View style={layout.header}>
        <AppText variant="h1" accessibilityRole="header">
          {t('camp.game.name.imposter')}
        </AppText>
        <AppText variant="caption">
          {t('camp.imp.roundLine', { n: round, m: info.players.length })}
        </AppText>
        <View style={[layout.chip, styles.chip]}>
          <AppText variant="chip">{t('camp.imp.hostLine', { name: hostName })}</AppText>
        </View>
      </View>

      {secret ? (
        <RoundCard
          key={round}
          secret={secret}
          captured={captured}
          word={wordOf(secret.wordId)}
          category={category}
        />
      ) : null}

      {phase === 'revealed' ? (
        <View testID="imp.result" style={[layout.panel, styles.panel]}>
          <AppText variant="h3">
            {t('camp.imp.wasImposter', { names: imposterNames.join(', ') })}
          </AppText>
          {info.wordId ? (
            <AppText variant="body">
              {t('camp.imp.wasWord', { word: wordOf(info.wordId) })}
            </AppText>
          ) : null}
        </View>
      ) : null}

      {secret ? (
        <>
          <View style={layout.section}>
            <AppText variant="h3" accessibilityRole="header">
              {t('camp.imp.clueOrder')}
            </AppText>
            {order.map((entry, index) => (
              <AppText key={entry.seatId} variant="body">
                {`${index + 1}. ${entry.name}`}
              </AppText>
            ))}
          </View>
          <View style={[layout.hint, styles.panel]}>
            <IrbisMascot size={secretSizes.mascot} accessibilityLabel={t('camp.imp.mascot')} />
            <AppText variant="small" style={layout.fill}>
              {t('camp.imp.hint')}
            </AppText>
          </View>
        </>
      ) : null}

      {host ? (
        <View style={layout.section}>
          {phase === 'dealt' ? (
            <AppButton
              testID="imp.reveal"
              label={t('camp.imp.reveal')}
              variant="secondary"
              onPress={host.onReveal}
            />
          ) : null}
          <AppButton
            testID="imp.new-round"
            label={t('camp.imp.newRound')}
            onPress={host.onNewRound}
          />
        </View>
      ) : (
        <AppText variant="small" tone="muted" style={layout.center}>
          {t('camp.imp.waitHost')}
        </AppText>
      )}
    </View>
  );
}

type CardProps = {
  secret: Secret;
  captured: boolean;
  word: string;
  category: string;
};

/** One round's card: word or imposter; the imposter's first release opens the explainer. */
function RoundCard({ secret, captured, word, category }: CardProps) {
  const [explaining, setExplaining] = useState(false);
  const [explained, setExplained] = useState(false);
  const imposter = secret.role === 'imposter';
  const shownCategory = secret.showCategory ? category : null;

  if (imposter && explaining && !captured) {
    return (
      <ImposterExplainer
        category={shownCategory}
        onGotIt={() => {
          setExplaining(false);
          setExplained(true);
        }}
      />
    );
  }
  return (
    <SecretCard
      captured={captured}
      onHide={() => {
        if (imposter && !explained) {
          setExplaining(true);
        }
      }}
    >
      {imposter ? (
        <ImposterSecret category={shownCategory} />
      ) : (
        <WordSecret word={word} category={category} />
      )}
    </SecretCard>
  );
}

const layout = StyleSheet.create({
  root: { gap: spacing[20] },
  header: { gap: spacing[6], alignItems: 'flex-start' },
  chip: {
    minHeight: sizes.chipHeight,
    paddingHorizontal: sizes.chipPaddingHorizontal,
    borderRadius: radii.pill,
    borderWidth: borders.card,
    justifyContent: 'center',
  },
  panel: {
    padding: spacing[16],
    borderRadius: radii.card,
    borderWidth: borders.card,
    gap: spacing[8],
  },
  section: { gap: spacing[8] },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    padding: spacing[16],
    borderRadius: radii.card,
    borderWidth: borders.card,
  },
  fill: { flex: 1 },
  center: { textAlign: 'center' },
});

const useStyles = createThemedStyles(c => ({
  chip: { borderColor: c.line, backgroundColor: c.card },
  panel: { borderColor: c.line, backgroundColor: c.card },
}));
