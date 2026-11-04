import { Share, StyleSheet, View } from 'react-native';

import { AppText } from '../../../shared/components/AppText';
import { Pressable } from '../../../shared/components/Pressable';
import { toast } from '../../../shared/components/toastBus';
import { borders, radii, sizes, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles } from '../../../shared/contexts/theme';
import { t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { qaLog } from '../../../shared/utils/qaLog';

type Channel = 'telegram' | 'sms' | 'link';

const CHANNELS: { channel: Channel; label: string }[] = [
  { channel: 'telegram', label: 'trip.shareTelegram' },
  { channel: 'sms', label: 'trip.shareSms' },
  { channel: 'link', label: 'trip.shareLink' },
];

type Props = {
  /** The plan as one message (`trip.shareText`). */
  shareText: string;
};

/** Share the plan (AC6): every chip opens the system share sheet; the chip only records the channel. */
export function ShareChips({ shareText }: Props) {
  const styles = useStyles();

  const share = async (channel: Channel) => {
    haptics.tap();
    qaLog('trip_shared', { channel });
    try {
      await Share.share({ message: shareText });
    } catch {
      haptics.error();
      toast.show({ variant: 'error', message: t('errors.generic') });
    }
  };

  return (
    <View style={layout.chips}>
      {CHANNELS.map(({ channel, label }) => (
        <Pressable
          key={channel}
          testID={`trip.share.${channel}`}
          accessibilityRole="button"
          accessibilityLabel={t(label)}
          onPress={() => void share(channel)}
          style={styles.chip}
        >
          <AppText variant="chip" tone="ink">
            {t(label)}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

const layout = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[8] },
});

const useStyles = createThemedStyles(c => ({
  chip: {
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[14],
    borderRadius: radii.pill,
    borderWidth: borders.card,
    borderColor: c.line,
    backgroundColor: c.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
