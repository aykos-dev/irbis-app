import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { Sheet } from '../../../shared/components/Sheet';
import { spacing } from '../../../shared/constants/spacing';
import { t } from '../../../shared/i18n';
import { MeetingMap, type LatLng } from './MeetingMap';

const MAP_HEIGHT = 280;

type Props = {
  center: LatLng;
  initial: LatLng | null;
  onDone: (pin: LatLng | null) => void;
  onDismiss: () => void;
};

/** "Pin on map" (canvas CreateTrip): tap to drop the meeting pin, Save or Clear. */
export function PinSheet({ center, initial, onDone, onDismiss }: Props) {
  const [pin, setPin] = useState<LatLng | null>(initial);
  const [closing, setClosing] = useState(false);
  const finish = (value: LatLng | null) => {
    onDone(value);
    setClosing(true);
  };
  return (
    <Sheet testID="create-trip.pin-sheet" accessibilityLabel={t('tripEvents.meeting.pinTitle')} closing={closing} onDismiss={onDismiss}>
      <View style={layout.wrap}>
        <AppText variant="h2" accessibilityRole="header">
          {t('tripEvents.meeting.pinTitle')}
        </AppText>
        <AppText variant="body" tone="muted">
          {t('tripEvents.meeting.pinHint')}
        </AppText>
        <MeetingMap testID="create-trip.pin-map" center={center} pin={pin} height={MAP_HEIGHT} onPick={setPin} />
        <View style={layout.buttons}>
          <View style={layout.button}>
            <AppButton testID="create-trip.pin-clear" variant="white" label={t('tripEvents.meeting.clear')} onPress={() => finish(null)} />
          </View>
          <View style={layout.button}>
            <AppButton testID="create-trip.pin-save" label={t('tripEvents.meeting.save')} disabled={pin === null} onPress={() => finish(pin)} />
          </View>
        </View>
      </View>
    </Sheet>
  );
}

const layout = StyleSheet.create({
  wrap: { gap: spacing[16] },
  buttons: { flexDirection: 'row', gap: spacing[12] },
  button: { flex: 1 },
});
