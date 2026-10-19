import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { AppText } from '../../../shared/components/AppText';
import { borders, radii, spacing } from '../../../shared/constants/spacing';
import { typography } from '../../../shared/constants/typography';
import {
  createThemedStyles,
  ThemeProvider,
  useTheme,
} from '../../../shared/contexts/theme';
import { t } from '../../../shared/i18n';
import { lobbySizes } from '../campTheme';

type Props = {
  joinUrl: string;
  code: string;
  /** Hotspot name, when the app created the hotspot (the password is only in the QR). */
  ssid: string | null;
  /** Under the code: "password in the QR" (Android hotspot) or "join in Settings first" (iPhone). */
  note: string | null;
};

/** White QR card: scan to join Wi-Fi and room, the room code, the hotspot name and a note. */
export function RoomQr(props: Props) {
  return (
    <ThemeProvider scheme="light">
      <Card {...props} />
    </ThemeProvider>
  );
}

function Card({ joinUrl, code, ssid, note }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={[layout.card, styles.card]}>
      <AppText variant="h3" style={layout.center}>
        {t('camp.lobby.scan')}
      </AppText>
      <View
        testID="camp.lobby.qr"
        accessible
        accessibilityRole="image"
        accessibilityLabel={t('camp.lobby.scan')}
      >
        <QRCode
          value={joinUrl}
          size={lobbySizes.qr}
          color={colors.ink}
          backgroundColor={colors.card}
        />
      </View>
      <AppText
        testID="camp.lobby.code"
        variant="stat"
        style={layout.code}
        accessibilityRole="header"
      >
        {code}
      </AppText>
      {ssid || note ? (
        <View style={layout.wifi}>
          {ssid ? (
            <AppText variant="body" tone="ink" style={layout.center}>
              {ssid}
            </AppText>
          ) : null}
          {note ? (
            <AppText
              testID="camp.lobby.qr-note"
              variant="small"
              style={layout.center}
            >
              {note}
            </AppText>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const layout = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: spacing[12],
    padding: spacing[20],
    borderRadius: radii.card,
    borderWidth: borders.card,
  },
  center: { textAlign: 'center' },
  code: {
    fontSize: lobbySizes.codeFont,
    lineHeight: lobbySizes.codeFont,
    fontFamily: typography.stat.fontFamily,
  },
  wifi: { alignItems: 'center', gap: spacing[4] },
});

const useStyles = createThemedStyles(c => ({
  card: { backgroundColor: c.card, borderColor: c.line },
}));
