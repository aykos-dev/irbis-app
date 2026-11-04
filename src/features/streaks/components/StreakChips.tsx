import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Pressable } from '../../../shared/components/Pressable';
import { Skeleton } from '../../../shared/components/Skeleton';
import { radii, sizes, spacing } from '../../../shared/constants/spacing';
import { t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { qaLog } from '../../../shared/utils/qaLog';
import { useStreaks } from '../hooks/useStreaks';
import { StreakGlyph } from './StreakGlyph';
import { StreakSheet } from './StreakSheet';

const SKELETON_CHIP = 44;

/** `streaks_seen` goes once per app session. */
let seenLogged = false;

/**
 * Path header streak chips (AC6): flame + boot (+ shield badge), tap → Streak sheet. Accounts only;
 * skeleton while loading, hidden on error or offline without a cached value.
 */
export function StreakChips() {
  const { signedIn, data, error, fetchStatus } = useStreaks();
  const [sheet, setSheet] = useState<'open' | 'closing' | null>(null);

  useEffect(() => {
    if (data && !seenLogged) {
      seenLogged = true;
      qaLog('streaks_seen', { flame: data.flame.count, boot: data.boot.count });
    }
  }, [data]);

  if (!signedIn) {
    return null;
  }
  if (!data) {
    if (error || fetchStatus === 'paused') {
      return null;
    }
    return (
      <View testID="path.streak.skeleton" style={layout.row}>
        <Skeleton width={SKELETON_CHIP} height={sizes.chipHeight} radius={radii.pill} />
        <Skeleton width={SKELETON_CHIP} height={sizes.chipHeight} radius={radii.pill} />
      </View>
    );
  }

  const { flame, boot } = data;
  const open = () => {
    haptics.tap();
    qaLog('streak_sheet_open', {});
    setSheet('open');
  };
  return (
    <View style={layout.row}>
      <Pressable
        testID="path.streak.flame"
        accessibilityRole="button"
        accessibilityLabel={t('streaks.flameA11y', { count: flame.count })}
        onPress={open}
      >
        <StreakGlyph kind="flame" count={flame.count} lit={flame.doneToday} />
      </Pressable>
      <Pressable
        testID="path.streak.boot"
        accessibilityRole="button"
        accessibilityLabel={t(boot.shieldedLastWeek ? 'streaks.bootShieldedA11y' : 'streaks.bootA11y', {
          count: boot.count,
        })}
        onPress={open}
      >
        <StreakGlyph kind="boot" count={boot.count} shielded={boot.shieldedLastWeek} shieldTestID="path.streak.shield" />
      </Pressable>
      {sheet ? (
        <StreakSheet
          streaks={data}
          closing={sheet === 'closing'}
          onClose={() => setSheet('closing')}
          onDismiss={() => setSheet(null)}
        />
      ) : null}
    </View>
  );
}

const layout = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[12] },
});
