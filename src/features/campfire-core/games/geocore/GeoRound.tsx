import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '../../../../shared/components/AppButton';
import { AppText } from '../../../../shared/components/AppText';
import { radii, spacing } from '../../../../shared/constants/spacing';
import { t } from '../../../../shared/i18n';
import { MuteButton } from '../../../../shared/sounds/MuteButton';
import type { LatLng } from '../../../../shared/utils/geo';
import { geoScreenColors } from '../../campTheme';
import type { GeoPoint, GeoPublic } from '../../protocol/codec';
import { localized } from '../packs';
import { countryByIso } from './geoData';
import { GEO_QUESTION_MS, geoRanks } from './geoGame';
import { isCountryMode, modeName, num, promptText } from './geoText';
import { GeoTimerRing } from './GeoTimerRing';
import { Globe } from './Globe';

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

/** One question on every dealt phone (AC3, canvas GeoRound / GeoRoundCity): prompt, globe, lock in. */
export function GeoRound({ info, selfSeatId, onGuess }: Props) {
  const [iso, setIso] = useState<string | null>(null);
  const [pin, setPin] = useState<LatLng | null>(null);
  const [sent, setSent] = useState(false);
  const countryMode = isCountryMode(info.mode);
  const locked = sent || info.answered.includes(selfSeatId);
  const prompt = promptText(info.mode, info.promptId);
  const city = info.mode === 'cityDistance';
  const card = city ? geoScreenColors.promptCity : geoScreenColors.prompt;
  const ink = { color: card.ink };
  const picked = countryByIso(iso ?? '');
  const ready = countryMode ? iso !== null && pin !== null : pin !== null;

  const lockLabel = !ready
    ? t('camp.geo.pickFirst')
    : countryMode
      ? t('camp.geo.lockCountry', {
          country: picked ? localized(picked.name) : iso ?? '',
        })
      : t('camp.geo.lockPin');

  const lockIn = () => {
    if (!ready || locked || !pin) {
      return;
    }
    setSent(true);
    onGuess({
      lat: pin.lat,
      lng: pin.lng,
      ...(countryMode && iso ? { iso } : {}),
    });
  };

  return (
    <View style={layout.root}>
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

      <Globe
        mode={countryMode ? 'country' : 'point'}
        selectedIso={countryMode ? iso : undefined}
        myPin={countryMode ? undefined : pin}
        disabled={locked}
        onSelectCountry={(code, at) => {
          setIso(code);
          setPin(at);
        }}
        onDropPin={setPin}
      />

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
    </View>
  );
}

const layout = StyleSheet.create({
  root: { gap: spacing[16] },
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
