import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { TripDto } from '../../../shared/api/generated/model';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { createThemedStyles } from '../../../shared/contexts/theme';
import { spacing } from '../../../shared/constants/spacing';
import { t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { isValidNewBackBy, tashkentClock, tashkentDay, toInstant, type Clock } from '../tripTimes';
import { TimeRow } from './TimeRow';

type Props = {
  trip: TripDto;
  locale: string;
  disabled: boolean;
  /** Sends the new back-by (ISO); resolves true once saved. */
  onChange: (backBy: string) => Promise<boolean>;
};

/**
 * Change return time (AC7): "Change return time" opens day + time pickers for the active trip.
 * A pick after now and within 72 h of the start is sent at once; anything else shows the inline error.
 */
export function BackByPicker({ trip, locale, disabled, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const styles = useStyles();
  const current = new Date(trip.backBy);
  const day = tashkentDay(current);
  const clock = tashkentClock(current);

  const pick = async (nextDay: string, nextClock: Clock) => {
    const next = toInstant(nextDay, nextClock);
    if (!isValidNewBackBy(new Date(trip.startAt), next, new Date())) {
      haptics.error();
      setInvalid(true);
      return;
    }
    setInvalid(false);
    if (await onChange(next.toISOString())) {
      setOpen(false);
    }
  };

  return (
    <View style={layout.wrap}>
      <AppButton
        testID="home.trip.backby"
        variant="white"
        label={t('trip.card.changeBackBy')}
        disabled={disabled}
        onPress={() => setOpen(value => !value)}
      />
      {open ? (
        <TimeRow
          testID="home.trip.backby.time"
          label={t('trip.backBy')}
          day={day}
          clock={clock}
          locale={locale}
          onClockChange={nextClock => void pick(day, nextClock)}
          dayPicker={{ minDay: tashkentDay(new Date(trip.startAt)), onDayChange: nextDay => void pick(nextDay, clock) }}
        />
      ) : null}
      {open && invalid ? (
        <AppText testID="home.trip.backby.error" variant="small" accessibilityRole="alert" style={styles.error}>
          {t('trip.timesInvalid')}
        </AppText>
      ) : null}
    </View>
  );
}

const layout = StyleSheet.create({
  wrap: { gap: spacing[12] },
});

const useStyles = createThemedStyles(c => ({
  error: { color: c.red700 },
}));
