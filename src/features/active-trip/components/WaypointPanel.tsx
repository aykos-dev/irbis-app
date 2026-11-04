import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { Mascot } from '../../../shared/components/Mascot';
import { borders, sizes, spacing } from '../../../shared/constants/spacing';
import { useTheme } from '../../../shared/contexts/theme';
import { t } from '../../../shared/i18n';
import type { WaypointCheckIn } from '../hooks/useWaypointCheckIn';
import { XpChip } from './XpChip';

const RING = sizes.placeTypeDot + spacing[12];
const STROKE = borders.ring;
const RADIUS = (RING - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const MASCOT = sizes.placeTypeDot - spacing[8];

/** Fox in a ring filled by logged / max waypoints. */
function ProgressRing({ count, max }: { count: number; max: number }) {
  const { colors } = useTheme();
  const filled = max > 0 ? Math.min(count / max, 1) : 0;
  return (
    <View style={layout.ring} importantForAccessibility="no-hide-descendants">
      <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
        <Circle cx={RING / 2} cy={RING / 2} r={RADIUS} stroke={colors.line} strokeWidth={STROKE} fill="none" />
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={RADIUS}
          stroke={colors.orange}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          strokeDashoffset={CIRCUMFERENCE * (1 - filled)}
          transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
        />
      </Svg>
      <Mascot kind="fox" size={MASCOT} />
    </View>
  );
}

type Props = { checkIn: WaypointCheckIn; sos: ReactNode };

/** Waypoint check-in (AC6): next waypoint, hint, feedback line, the floating XP chip and the button. */
export function WaypointPanel({ checkIn, sos }: Props) {
  const { count, max, allDone, busy, message, xpFlash } = checkIn;
  return (
    <View style={layout.root}>
      <View style={layout.row}>
        <ProgressRing count={count} max={max} />
        <View style={layout.fill}>
          <AppText testID="active.waypoint.next" variant="h3">
            {allDone ? t('active.waypoint.allDone', { max }) : t('active.waypoint.next', { n: count + 1 })}
          </AppText>
          {allDone ? null : <AppText variant="small">{t('active.waypoint.hint')}</AppText>}
          {message ? (
            <AppText testID="active.waypoint.msg" variant="small" tone="teal700" accessibilityLiveRegion="polite">
              {message}
            </AppText>
          ) : null}
        </View>
        {xpFlash ? <XpChip key={xpFlash.id} xp={xpFlash.xp} /> : null}
      </View>
      <View style={layout.actions}>
        <View style={layout.fill}>
          <AppButton
            testID="active.waypoint.checkin"
            variant="secondary"
            label={t('active.waypoint.cta')}
            loading={busy}
            disabled={allDone || busy}
            onPress={checkIn.checkIn}
          />
        </View>
        {sos}
      </View>
    </View>
  );
}

const layout = StyleSheet.create({
  root: { gap: spacing[12] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[12] },
  ring: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  fill: { flex: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing[12] },
});
