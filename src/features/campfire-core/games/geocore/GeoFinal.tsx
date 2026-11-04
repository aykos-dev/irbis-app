import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '../../../../shared/components/AppButton';
import { AppText } from '../../../../shared/components/AppText';
import { borders, radii, spacing } from '../../../../shared/constants/spacing';
import { createThemedStyles } from '../../../../shared/contexts/theme';
import { t } from '../../../../shared/i18n';
import { sounds } from '../../../../shared/sounds/sounds';
import { haptics } from '../../../../shared/utils/haptics';
import { geoScreenColors, geoScreenSizes } from '../../campTheme';
import type { GeoPublic, RosterPlayer } from '../../protocol/codec';
import { Confetti } from '../mafia/GameOver';
import { geoRanks } from './geoGame';
import { modeName, nameIn, num } from './geoText';
import { seatColor, SeatRing, type GeoHostControls } from './GeoReveal';

type Place = 1 | 2 | 3;
/** Podium order on screen, like the board: 2 · 1 · 3. */
const PODIUM_ORDER: Place[] = [2, 1, 3];

type Props = {
  info: GeoPublic;
  selfSeatId: string;
  roster: RosterPlayer[];
  host?: GeoHostControls;
};

/** The final results on every dealt phone (AC7, canvas GeoFinal): winner, podium, everyone's total. */
export function GeoFinal({ info, selfSeatId, roster, host }: Props) {
  const styles = useStyles();
  const ranks = geoRanks(info.totals);
  const winners = ranks.filter(rank => rank.place === 1);
  const iWon = winners.some(rank => rank.seatId === selfSeatId);
  const name = (seatId: string) =>
    seatId === selfSeatId ? t('camp.geo.you') : nameIn(roster, seatId);

  useEffect(() => {
    haptics.heavy();
    if (iWon) {
      void sounds.load().then(() => sounds.play('complete', 'geo_'));
    }
  }, [iWon]);

  const title =
    winners.length > 1
      ? t('camp.geo.tieWin', { names: winners.map(rank => name(rank.seatId)).join(' · ') })
      : iWon
        ? t('camp.geo.youWin')
        : t('camp.geo.wins', { name: nameIn(roster, winners[0]?.seatId ?? '') });

  return (
    <View style={layout.root}>
      <Confetti />
      <View style={layout.header}>
        <AppText variant="small" tone="muted">
          {t('camp.geo.finalLine', { mode: modeName(info.mode), of: info.of })}
        </AppText>
        <AppText variant="h1" accessibilityRole="header" style={layout.center}>
          {title}
        </AppText>
      </View>

      <View style={layout.podium}>
        {PODIUM_ORDER.map(place => {
          const group = ranks.filter(rank => rank.place === place);
          const first = group[0];
          if (!first) {
            return null;
          }
          const tie = group.length > 1;
          return (
            <View
              key={place}
              testID={`geo.podium.${place}`}
              accessible
              style={layout.column}
            >
              <View style={layout.stack}>
                {group.map((rank, index) => (
                  <View key={rank.seatId} style={index > 0 ? layout.overlap : null}>
                    <SeatRing
                      player={roster.find(seat => seat.seatId === rank.seatId)}
                      color={seatColor(info, rank.seatId).color}
                      size={geoScreenSizes.podiumAvatar}
                    />
                  </View>
                ))}
              </View>
              <AppText variant="small" numberOfLines={2} style={layout.center}>
                {group.map(rank => name(rank.seatId)).join(' · ')}
              </AppText>
              <View
                style={[
                  layout.step,
                  {
                    height: geoScreenSizes.step[place],
                    backgroundColor: geoScreenColors.step[place],
                  },
                ]}
              >
                <AppText variant="h2" style={{ color: geoScreenColors.onStep[place] }}>
                  {place}
                </AppText>
                <AppText variant="small" style={{ color: geoScreenColors.onStep[place] }}>
                  {tie ? `${num(first.total)} · ${t('camp.geo.tie')}` : num(first.total)}
                </AppText>
              </View>
            </View>
          );
        })}
      </View>

      <View testID="geo.final" style={layout.list}>
        <AppText variant="h3" accessibilityRole="header">
          {t('camp.geo.everyoneTotal')}
        </AppText>
        {ranks.map(rank => (
          <View
            key={rank.seatId}
            testID={`geo.final.${rank.seatId}`}
            accessible
            style={[layout.row, styles.row, rank.seatId === selfSeatId ? layout.mine : null]}
          >
            <AppText variant="h3">{rank.place}</AppText>
            <SeatRing
              player={roster.find(seat => seat.seatId === rank.seatId)}
              color={seatColor(info, rank.seatId).color}
              size={geoScreenSizes.rowAvatar}
            />
            <AppText variant="body" numberOfLines={1} style={layout.fill}>
              {name(rank.seatId)}
            </AppText>
            <AppText variant="h3">{num(rank.total)}</AppText>
          </View>
        ))}
      </View>

      {host ? (
        <View style={layout.buttons}>
          <AppButton
            testID="geo.play-again"
            label={t('camp.geo.playAgain')}
            onPress={host.onPlayAgain}
          />
          <AppButton
            testID="geo.lobby"
            label={t('camp.geo.lobby')}
            variant="white"
            onPress={host.onLobby}
          />
        </View>
      ) : (
        <AppText testID="geo.waiting" variant="body" tone="muted" style={layout.center}>
          {t('camp.geo.waitingHost')}
        </AppText>
      )}
    </View>
  );
}

const layout = StyleSheet.create({
  root: { gap: spacing[20] },
  header: { gap: spacing[6], alignItems: 'center' },
  center: { textAlign: 'center' },
  podium: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[8] },
  column: { flex: 1, alignItems: 'center', gap: spacing[6] },
  stack: { flexDirection: 'row' },
  overlap: { marginLeft: -geoScreenSizes.podiumOverlap },
  step: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: radii.tile,
    borderTopRightRadius: radii.tile,
  },
  list: { gap: spacing[8] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    padding: spacing[12],
    borderRadius: radii.card,
    borderWidth: borders.card,
  },
  mine: { backgroundColor: geoScreenColors.mine, borderColor: geoScreenColors.mineEdge },
  fill: { flex: 1 },
  buttons: { gap: spacing[12] },
});

const useStyles = createThemedStyles(c => ({
  row: { borderColor: c.line, backgroundColor: c.card },
}));
