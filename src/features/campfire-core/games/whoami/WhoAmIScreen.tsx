import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '../../../../shared/components/AppButton';
import { AppText } from '../../../../shared/components/AppText';
import { borders, radii, spacing } from '../../../../shared/constants/spacing';
import { createThemedStyles } from '../../../../shared/contexts/theme';
import { t } from '../../../../shared/i18n';
import { haptics } from '../../../../shared/utils/haptics';
import { partySizes, secretSizes } from '../../campTheme';
import { ConfirmSheet } from '../../components/ConfirmSheet';
import type { PublicGame, RosterPlayer, WhoamiSecret } from '../../protocol/codec';
import { SeatAvatar } from '../components/SeatAvatar';
import { SecretCard } from '../components/SecretCard';
import { findPack, localized } from '../packs';
import { useSecureScreen } from '../useSecureScreen';

type Props = {
  info: PublicGame;
  /** This phone's deal; null when it waits for the next round. */
  secret: WhoamiSecret | null;
  selfSeatId: string | null;
  roster: RosterPlayer[];
  /** "I know who I am!" confirmed: ask the host for our own character. */
  onShowMine: () => void;
  /** Host phone: New round instead of "the host starts the next round". */
  host?: { onNewRound: () => void };
};

/** Who am I round (AC6): your hidden card, everyone else's character, "I know who I am!". */
export function WhoAmIScreen({
  info,
  secret,
  selfSeatId,
  roster,
  onShowMine,
  host,
}: Props) {
  const styles = useStyles();
  const { captured } = useSecureScreen();
  const [confirming, setConfirming] = useState(false);
  const pack = findPack(info.packId);
  const characterOf = (characterId: string) => {
    const item =
      pack && pack.game === 'whoami'
        ? pack.items.find(entry => entry.id === characterId)
        : undefined;
    return item ? localized(item) : '';
  };
  const playerOf = (seatId: string | null) =>
    roster.find(player => player.seatId === seatId);
  const you = t('camp.who.you', { name: playerOf(selfSeatId)?.nickname ?? '' });
  const others = (secret?.others ?? []).flatMap(other => {
    const player = playerOf(other.seatId);
    return player ? [{ ...other, player }] : [];
  });

  return (
    <View testID="whoami.screen" style={layout.root}>
      <View style={layout.header}>
        <AppText variant="h1" accessibilityRole="header">
          {t('camp.who.title')}
        </AppText>
        <AppText variant="caption">
          {t('camp.who.packLine', {
            pack: pack ? localized(pack.name) : '',
            n: info.players.length,
          })}
        </AppText>
      </View>

      {secret?.mine ? (
        <SecretCard captured={captured}>
          <View testID="whoami.mine" style={layout.mine}>
            <AppText variant="caption" tone="muted">
              {you}
            </AppText>
            <AppText variant="h1" style={layout.center}>
              {characterOf(secret.mine)}
            </AppText>
          </View>
        </SecretCard>
      ) : null}
      {secret && !secret.mine ? (
        <View
          testID="whoami.own"
          accessible
          accessibilityLabel={`${you}. ${t('camp.who.hidden')}`}
          style={[layout.own, styles.own]}
        >
          <AppText variant="h1">?</AppText>
          <AppText variant="h3">{you}</AppText>
          <AppText variant="small" tone="muted" style={layout.center}>
            {t('camp.who.hidden')}
          </AppText>
        </View>
      ) : null}

      {secret ? (
        <View style={layout.section}>
          <AppText variant="h3" accessibilityRole="header">
            {t('camp.who.othersTitle')}
          </AppText>
          <AppText variant="small" tone="muted">
            {t('camp.who.othersSub')}
          </AppText>
          {others.map(({ seatId, characterId, player }) => {
            const character = characterOf(characterId);
            return (
              <View
                key={seatId}
                testID={`whoami.player.${seatId}`}
                accessible
                accessibilityLabel={`${player.nickname}: ${character}`}
                style={[layout.row, styles.row]}
              >
                <SeatAvatar avatar={player.avatar} size={partySizes.rowAvatar} />
                <View style={layout.fill}>
                  <AppText variant="small" tone="muted" numberOfLines={1}>
                    {player.nickname}
                  </AppText>
                  <AppText variant="h3">{character}</AppText>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      {secret && !secret.mine ? (
        <AppButton
          testID="whoami.show-mine"
          label={t('camp.who.knowIt')}
          variant="secondary"
          onPress={() => {
            haptics.tap();
            setConfirming(true);
          }}
        />
      ) : null}

      {host ? (
        <AppButton
          testID="whoami.new-round"
          label={t('camp.wyr.newRound')}
          onPress={host.onNewRound}
        />
      ) : (
        <AppText variant="small" tone="muted" style={layout.center}>
          {t('camp.who.waitHost')}
        </AppText>
      )}

      {confirming ? (
        <ConfirmSheet
          testID="whoami.show-sheet"
          title={t('camp.who.showConfirm')}
          confirmLabel={t('camp.who.show')}
          confirmTestID="whoami.show-confirm"
          cancelTestID="whoami.show-cancel"
          onConfirm={() => {
            setConfirming(false);
            onShowMine();
          }}
          onDismiss={() => setConfirming(false)}
        />
      ) : null}
    </View>
  );
}

const layout = StyleSheet.create({
  root: { gap: spacing[20] },
  header: { gap: spacing[6], alignItems: 'flex-start' },
  own: {
    minHeight: secretSizes.cardMinHeight,
    borderRadius: radii.largeCard,
    borderWidth: borders.card,
    borderBottomWidth: borders.edge,
    padding: spacing[20],
    gap: spacing[8],
    alignItems: 'center',
    justifyContent: 'center',
  },
  mine: { alignItems: 'center', gap: spacing[8], paddingVertical: spacing[20] },
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
  center: { textAlign: 'center' },
});

const useStyles = createThemedStyles(c => ({
  own: { backgroundColor: c.soft, borderColor: c.line },
  row: { backgroundColor: c.card, borderColor: c.line },
}));
