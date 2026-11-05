import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '../../../../shared/components/AppButton';
import { AppText } from '../../../../shared/components/AppText';
import { radii, spacing } from '../../../../shared/constants/spacing';
import { t } from '../../../../shared/i18n';
import { MuteButton } from '../../../../shared/sounds/MuteButton';
import type { LatLng } from '../../../../shared/utils/geo';
import { geoScreenColors } from '../../campTheme';
import type { GeoPoint, GeoPublic } from '../../protocol/codec';
import { GEO_QUESTION_MS, geoRanks } from './geoGame';
import { isCountryMode, modeName, num, promptText } from './geoText';
import { GeoTimerRing } from './GeoTimerRing';
import type { GlobeProps } from './Globe';

type Props = {
  info: GeoPublic;
  selfSeatId: string;
  onGuess: (point: GeoPoint) => void;
};

/** "Mode · Round n / 10", own total and place, mute (shared by the round and the reveal). */
export function GeoHeader({ info, selfSeatId }: Pick<Props, 'info' | 'selfSeatId'>) {
  const ranks = geoRanks(info.totals);
  const mine = ranks.find(rank => rank.seatId === selfSeatId);
  return (
    <View style={layout.header}>
      <View style={layout.fill}>
        <AppText variant="small" tone="muted">
          {t('camp.geo.roundOf', {
            mode: modeName(info.mode),
            n: info.roundNo,
            of: info.of,
          })}
        </AppText>
        {mine ? (
          <AppText variant="body">
            {t('camp.geo.youTotal', {
              total: num(mine.total),
              place: mine.place,
              count: ranks.length,
            })}
          </AppText>
        ) : null}
      </View>
      <MuteButton
        testID="geo.mute"
        muteLabel={t('camp.xo.mute')}
        unmuteLabel={t('camp.xo.unmute')}
      />
    </View>
  );
}

/** This phone's pick in the current question (a new question starts empty). */
export type RoundPick = { iso: string | null; pin: LatLng | null; sent: boolean };
export type UpdatePick = (patch: Partial<RoundPick>) => void;

const noPick: RoundPick = { iso: null, pin: null, sent: false };

export function useRoundPick(roundNo: number): [RoundPick, UpdatePick] {
  const [state, setState] = useState<RoundPick & { roundNo: number }>({
    ...noPick,
    roundNo,
  });
  const update = useCallback<UpdatePick>(
    patch =>
      setState(prev => ({
        ...(prev.roundNo === roundNo ? prev : noPick),
        ...patch,
        roundNo,
      })),
    [roundNo],
  );
  return [state.roundNo === roundNo ? state : noPick, update];
}

const isLocked = (info: GeoPublic, selfSeatId: string, pick: RoundPick) =>
  pick.sent || info.answered.includes(selfSeatId);

/** The map during a question: tap a country or drop a pin until locked in. */
export function roundGlobeProps(
  info: GeoPublic,
  selfSeatId: string,
  pick: RoundPick,
  update: UpdatePick,
): GlobeProps {
  const countryMode = isCountryMode(info.mode);
  return {
    mode: countryMode ? 'country' : 'point',
    selectedIso: countryMode ? pick.iso : undefined,
    myPin: countryMode ? undefined : pick.pin,
    disabled: isLocked(info, selfSeatId, pick),
    onSelectCountry: (code, at) => update({ iso: code, pin: at }),
    onDropPin: at => update({ pin: at }),
  };
}

/** Above the map in a question (AC3, canvas GeoRound / GeoRoundCity): header, prompt, timer. */
export function GeoRoundTop({ info, selfSeatId }: Pick<Props, 'info' | 'selfSeatId'>) {
  const prompt = promptText(info.mode, info.promptId);
  const city = info.mode === 'cityDistance';
  const card = city ? geoScreenColors.promptCity : geoScreenColors.prompt;
  const ink = { color: card.ink };
  return (
    <>
      <GeoHeader info={info} selfSeatId={selfSeatId} />
      <View style={layout.promptRow}>
        <View
          testID="geo.prompt"
          accessible
          style={[layout.prompt, { backgroundColor: card.bg }]}
        >
          <AppText variant="small" style={ink}>
            {prompt.caption}
          </AppText>
          <AppText variant="h2" accessibilityRole="header" style={ink}>
            {prompt.big}
          </AppText>
        </View>
        {info.remainingMs !== undefined ? (
          <GeoTimerRing remainingMs={info.remainingMs} totalMs={GEO_QUESTION_MS} />
        ) : null}
      </View>
    </>
  );
}

/** Below the map in a question: answered count and Lock in (sent once). */
export function GeoRoundBottom({
  info,
  selfSeatId,
  onGuess,
  pick,
  update,
}: Props & { pick: RoundPick; update: UpdatePick }) {
  const countryMode = isCountryMode(info.mode);
  const locked = isLocked(info, selfSeatId, pick);
  const { iso, pin } = pick;
  const ready = countryMode ? iso !== null && pin !== null : pin !== null;

  const lockLabel = !ready
    ? t('camp.geo.pickFirst')
    : countryMode
      ? t('camp.geo.lockAnswer')
      : t('camp.geo.lockPin');

  const lockIn = () => {
    if (!ready || locked || !pin) {
      return;
    }
    update({ sent: true });
    onGuess({
      lat: pin.lat,
      lng: pin.lng,
      ...(countryMode && iso ? { iso } : {}),
    });
  };

  return (
    <>
      <AppText testID="geo.answered" variant="small" tone="muted" style={layout.center}>
        {t('camp.geo.answered', {
          n: info.answered.length,
          total: Object.keys(info.totals).length,
        })}
      </AppText>
      {locked ? (
        <AppText testID="geo.waiting" variant="body" tone="muted" style={layout.center}>
          {t('camp.geo.waitingOthers')}
        </AppText>
      ) : (
        <AppButton
          testID="geo.lock"
          label={lockLabel}
          disabled={!ready}
          onPress={lockIn}
        />
      )}
    </>
  );
}

const layout = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[12] },
  fill: { flex: 1 },
  promptRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[12] },
  prompt: {
    flex: 1,
    gap: spacing[4],
    padding: spacing[16],
    borderRadius: radii.card,
  },
  center: { textAlign: 'center' },
});
