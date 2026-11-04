import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '../../../../shared/components/AppButton';
import { AppText } from '../../../../shared/components/AppText';
import { borders, radii, spacing } from '../../../../shared/constants/spacing';
import { createThemedStyles } from '../../../../shared/contexts/theme';
import { t } from '../../../../shared/i18n';
import { sounds } from '../../../../shared/sounds/sounds';
import { geoScreenColors, geoScreenSizes, geoSeatColors } from '../../campTheme';
import type { GeoPublic, RosterPlayer } from '../../protocol/codec';
import { SeatAvatar } from '../components/SeatAvatar';
import { geoRanks } from './geoGame';
import { answerText, isCountryMode, kmLabel, kmLine, nameIn, num } from './geoText';
import { GeoHeader } from './GeoRound';
import { useSecondsLeft } from './GeoTimerRing';
import { Globe, type GlobePin } from './Globe';
import type { GeoMode } from './scoring';

/** A round this good plays the `correct` clip, else `wrong` (points per round: 1,000, or 5,000 in City distance). */
export const GEO_GOOD_POINTS = { country: 900, city: 4_500 } as const;

export const goodRound = (mode: GeoMode, points: number) =>
  points >= (mode === 'cityDistance' ? GEO_GOOD_POINTS.city : GEO_GOOD_POINTS.country);

export type GeoHostControls = {
  onNext: () => void;
  onPlayAgain: () => void;
  onLobby: () => void;
};

/** Seat colour per dealt seat, in seat order (pins and avatar rings match). */
export const seatColor = (info: GeoPublic, seatId: string) => {
  const index = Math.max(0, Object.keys(info.totals).indexOf(seatId));
  return { index, color: geoSeatColors[index % geoSeatColors.length] ?? geoScreenColors.ring };
};

/** A seat's animal inside its seat-colour ring. */
export function SeatRing({
  player,
  color,
  size,
}: {
  player: RosterPlayer | undefined;
  color: string;
  size: number;
}) {
  if (!player) {
    return null;
  }
  return (
    <View style={[layout.seatRing, { borderColor: color }]}>
      <SeatAvatar avatar={player.avatar} size={size} />
    </View>
  );
}

type Props = {
  info: GeoPublic;
  selfSeatId: string;
  roster: RosterPlayer[];
  host?: GeoHostControls;
};

/** The round's answer on every dealt phone (AC6, canvas GeoReveal): own result, pins, standings. */
export function GeoReveal({ info, selfSeatId, roster, host }: Props) {
  const styles = useStyles();
  const seconds = useSecondsLeft(info.remainingMs ?? 0);
  const reveal = info.reveal;
  const mine = reveal?.results.find(result => result.seatId === selfSeatId);
  const points = mine?.points ?? 0;
  const countryMode = isCountryMode(info.mode);

  const clip = goodRound(info.mode, points) ? 'correct' : 'wrong';
  const heard = useRef<number | null>(null);

  // One clip per reveal on this phone.
  useEffect(() => {
    if (heard.current === info.roundNo) {
      return;
    }
    heard.current = info.roundNo;
    void sounds.load().then(() => sounds.play(clip, 'geo_'));
  }, [info.roundNo, clip]);

  if (!reveal) {
    return null;
  }
  const answer = { lat: reveal.answer.lat, lng: reveal.answer.lng };
  const pins: GlobePin[] = reveal.results.flatMap(result =>
    result.lat !== undefined && result.lng !== undefined
      ? [
          {
            seatId: result.seatId,
            point: { lat: result.lat, lng: result.lng },
            label:
              result.seatId === selfSeatId
                ? t('camp.geo.you')
                : kmLabel(result.km ?? 0),
            colorIndex: seatColor(info, result.seatId).index,
          },
        ]
      : [],
  );
  const answered = mine !== undefined && mine.lat !== undefined;
  const last = info.roundNo >= info.of;

  return (
    <View testID="geo.reveal" style={layout.root}>
      <GeoHeader info={info} selfSeatId={selfSeatId} />
      <AppText variant="h1" accessibilityRole="header" style={layout.center}>
        {answerText(info.mode, info.promptId)}
      </AppText>
      <View testID="geo.result" accessible style={layout.result}>
        {answered ? (
          <AppText variant="h2" style={layout.gain}>
            {t('camp.geo.yourResult', { points: num(points) })}
          </AppText>
        ) : null}
        <AppText variant="body" tone="muted">
          {kmLine(info.mode, answered ? (mine?.km ?? 0) : null)}
        </AppText>
      </View>

      <Globe
        mode={countryMode ? 'country' : 'point'}
        disabled
        answer={{ ...(reveal.answer.iso ? { iso: reveal.answer.iso } : {}), point: answer }}
        pins={pins}
        focus={answer}
        focusZoom={countryMode ? geoScreenSizes.zoomCountry : geoScreenSizes.zoomPoint}
      />

      <View style={layout.list}>
        <View style={layout.listHead}>
          <AppText variant="h3" accessibilityRole="header">
            {t('camp.geo.standingsAfter', { n: info.roundNo })}
          </AppText>
          <AppText variant="small" tone="muted">
            {t('camp.geo.thisRound')}
          </AppText>
        </View>
        {geoRanks(info.totals).map(rank => {
          const result = reveal.results.find(item => item.seatId === rank.seatId);
          const player = roster.find(seat => seat.seatId === rank.seatId);
          const me = rank.seatId === selfSeatId;
          const scored = result !== undefined && result.lat !== undefined;
          return (
            <View
              key={rank.seatId}
              testID={`geo.standings.${rank.seatId}`}
              accessible
              style={[layout.row, styles.row, me ? layout.mine : null]}
            >
              <AppText variant="h3">{rank.place}</AppText>
              <SeatRing
                player={player}
                color={seatColor(info, rank.seatId).color}
                size={geoScreenSizes.rowAvatar}
              />
              <View style={layout.fill}>
                <AppText variant="body" numberOfLines={1}>
                  {me ? t('camp.geo.you') : nameIn(roster, rank.seatId)}
                </AppText>
                <AppText variant="small" tone="muted">
                  {kmLine(info.mode, scored ? (result?.km ?? 0) : null)}
                </AppText>
              </View>
              <AppText variant="small" style={layout.gain}>
                {t('camp.geo.yourResult', { points: num(result?.points ?? 0) })}
              </AppText>
              <AppText variant="h3">{num(rank.total)}</AppText>
            </View>
          );
        })}
      </View>

      {host ? (
        <View style={layout.buttons}>
          <AppButton
            testID="geo.next"
            label={last ? t('camp.geo.seeResults') : t('camp.geo.nextRound')}
            onPress={host.onNext}
          />
          {last ? null : (
            <AppText variant="small" tone="muted" style={layout.center}>
              {t('camp.geo.nextIn', { s: seconds })}
            </AppText>
          )}
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
  root: { gap: spacing[16] },
  center: { textAlign: 'center' },
  result: { alignItems: 'center', gap: spacing[4] },
  gain: { color: geoScreenColors.gain },
  list: { gap: spacing[8] },
  listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
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
  seatRing: { borderWidth: geoScreenSizes.seatRing, borderRadius: radii.pill },
  buttons: { gap: spacing[8] },
});

const useStyles = createThemedStyles(c => ({
  row: { borderColor: c.line, backgroundColor: c.card },
}));
