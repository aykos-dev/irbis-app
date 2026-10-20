import { StyleSheet, View } from 'react-native';

import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { Mascot } from '../../../shared/components/Mascot';
import { Sheet } from '../../../shared/components/Sheet';
import { spacing } from '../../../shared/constants/spacing';
import { t } from '../../../shared/i18n';

const MASCOT = 96;
const MINUTE_MS = 60 * 1000;
const MINUTES_PER_HOUR = 60;

/** "hh:mm" left, rounded up to the minute. */
export function formatTimeLeft(ms: number): string {
  const minutes = Math.max(0, Math.ceil(ms / MINUTE_MS));
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(Math.floor(minutes / MINUTES_PER_HOUR))}:${pad(minutes % MINUTES_PER_HOUR)}`;
}

type Props = { msLeft: number; closing: boolean; onOk: () => void; onDismiss: () => void };

/** No hearts left today (AC6): sleepy Irbis, time until the midnight refill, OK. */
export function OutOfHeartsSheet({ msLeft, closing, onOk, onDismiss }: Props) {
  return (
    <Sheet testID="quiz.outofhearts" accessibilityLabel={t('lessons.hearts.outTitle')} closing={closing} onDismiss={onDismiss}>
      <View style={styles.head}>
        <Mascot kind="sleepy" size={MASCOT} />
        <AppText variant="h2" accessibilityRole="header" style={styles.center}>
          {t('lessons.hearts.outTitle')}
        </AppText>
        <AppText variant="body" tone="muted" style={styles.center}>
          {t('lessons.hearts.outBody', { time: formatTimeLeft(msLeft) })}
        </AppText>
      </View>
      <AppButton testID="quiz.outofhearts.ok" label={t('lessons.hearts.ok')} onPress={onOk} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: spacing[8] },
  center: { textAlign: 'center' },
});
