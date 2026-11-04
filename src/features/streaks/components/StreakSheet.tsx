import { StyleSheet, View } from 'react-native';

import type { StreaksDto } from '../../../shared/api/generated/model';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { Mascot } from '../../../shared/components/Mascot';
import { Sheet } from '../../../shared/components/Sheet';
import { spacing } from '../../../shared/constants/spacing';
import { t } from '../../../shared/i18n';
import { streakMood } from '../streakMood';
import { StreakGlyph } from './StreakGlyph';

const MASCOT = 104;

type Props = { streaks: StreaksDto; closing: boolean; onClose: () => void; onDismiss: () => void };

/** Streak sheet (AC6): both counts, today / this week, freezes left and the weather-shield line. */
export function StreakSheet({ streaks, closing, onClose, onDismiss }: Props) {
  const { flame, boot, freezes } = streaks;
  const mood = streakMood(streaks);
  return (
    <Sheet testID="streak.sheet" accessibilityLabel={t('streaks.sheet.title')} closing={closing} onDismiss={onDismiss}>
      <View style={layout.mascot}>
        <Mascot kind={mood} size={MASCOT} testID={`streak.mascot-${mood}`} accessibilityLabel={t('streaks.sheet.mascot')} />
      </View>
      <AppText variant="h2" accessibilityRole="header">
        {t('streaks.sheet.title')}
      </AppText>
      <View style={layout.counts}>
        <View testID="streak.flame" style={layout.count} accessible accessibilityLabel={t('streaks.flameA11y', { count: flame.count })}>
          <StreakGlyph kind="flame" count={flame.count} lit={flame.doneToday} />
          <AppText variant="small">{t('streaks.sheet.flame', { count: flame.count })}</AppText>
        </View>
        <View testID="streak.boot" style={layout.count} accessible accessibilityLabel={t('streaks.bootA11y', { count: boot.count })}>
          <StreakGlyph kind="boot" count={boot.count} shielded={boot.shieldedLastWeek} />
          <AppText variant="small">{t('streaks.sheet.boot', { count: boot.count })}</AppText>
        </View>
      </View>
      <AppText testID="streak.today" variant="body">
        {flame.doneToday ? t('streaks.sheet.todayDone') : t('streaks.sheet.todayNotYet')}
      </AppText>
      <AppText testID="streak.week" variant="body">
        {boot.doneThisWeek ? t('streaks.sheet.weekDone') : t('streaks.sheet.weekNotYet')}
      </AppText>
      <AppText testID="streak.freezes" variant="body">
        {t('streaks.sheet.freezes', { left: freezes.left, perMonth: freezes.perMonth })}
      </AppText>
      <AppText testID="streak.shield-line" variant="small">
        {t('streaks.sheet.shield')}
      </AppText>
      <AppButton testID="streak.close" label={t('common.close')} variant="white" onPress={onClose} />
    </Sheet>
  );
}

const layout = StyleSheet.create({
  mascot: { alignSelf: 'center' },
  counts: { flexDirection: 'row', gap: spacing[16] },
  count: { flex: 1, gap: spacing[4] },
});
