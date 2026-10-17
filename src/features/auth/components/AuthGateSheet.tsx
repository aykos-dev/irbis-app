import { StyleSheet, View } from 'react-native';

import type { GateReason } from '../../../shared/auth/gateBus';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { Icon, type IconName } from '../../../shared/components/Icon';
import { Mascot } from '../../../shared/components/Mascot';
import { Pressable } from '../../../shared/components/Pressable';
import { Sheet } from '../../../shared/components/Sheet';
import { mascotColors, palette } from '../../../shared/constants/colors';
import { radii, sizes, spacing } from '../../../shared/constants/spacing';
import { t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';

type Props = {
  reason: GateReason;
  closing: boolean;
  onCreate: () => void;
  onLogIn: () => void;
  onNotNow: () => void;
  onDismiss: () => void;
};

const MASCOT_SIZE = 84;
const PERK_ICON = 20;

/** Canvas AccGate (A3): the shared log-in prompt. Copy comes from `auth.gate.reasons.<reason>`. */
export function AuthGateSheet({ reason, closing, onCreate, onLogIn, onNotNow, onDismiss }: Props) {
  const perks: { icon: IconName; label: string; tint: string; color: string }[] = [
    { icon: 'star', label: t('auth.gate.perkLevel'), tint: palette.orangeTint, color: palette.orangeEdge },
    { icon: 'shield', label: t('auth.gate.perkTrips'), tint: palette.tealTint, color: palette.teal700 },
    { icon: 'person', label: t('auth.gate.perkCommunity'), tint: mascotColors.moodSleepy, color: palette.purple },
  ];

  return (
    <Sheet
      testID="auth.gate"
      accessibilityLabel={t(`auth.gate.reasons.${reason}.title`)}
      closing={closing}
      onDismiss={onDismiss}
    >
      <View style={styles.head}>
        <Mascot kind="proud" size={MASCOT_SIZE} accessibilityLabel={t('auth.mascot.proud')} />
        <View style={styles.headText}>
          <AppText variant="h2" accessibilityRole="header">
            {t(`auth.gate.reasons.${reason}.title`)}
          </AppText>
          <AppText variant="body" tone="muted">
            {t(`auth.gate.reasons.${reason}.body`)}
          </AppText>
        </View>
      </View>
      <View style={styles.perks}>
        {perks.map(perk => (
          <View key={perk.icon} style={styles.perk}>
            <View style={[styles.perkIcon, { backgroundColor: perk.tint }]}>
              <Icon name={perk.icon} color={perk.color} size={PERK_ICON} />
            </View>
            <AppText variant="body" tone="ink" style={styles.perkLabel}>
              {perk.label}
            </AppText>
          </View>
        ))}
      </View>
      <AppButton testID="auth.gate-signup" label={t('auth.gate.create')} onPress={onCreate} />
      <AppButton
        testID="auth.gate-login"
        label={t('auth.gate.haveAccount')}
        variant="white"
        onPress={onLogIn}
      />
      <Pressable
        testID="auth.gate-not-now"
        accessibilityLabel={t('auth.gate.notNow')}
        onPress={() => {
          haptics.tap();
          onNotNow();
        }}
        style={styles.notNow}
      >
        <AppText variant="body" tone="muted" style={styles.notNowText}>
          {t('auth.gate.notNow')}
        </AppText>
      </Pressable>
      <AppText variant="small" style={styles.centered}>
        {t('auth.gate.stays')}
      </AppText>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[14] },
  headText: { flex: 1, gap: spacing[4] },
  perks: { gap: spacing[10], paddingVertical: spacing[4] },
  perk: { flexDirection: 'row', alignItems: 'center', gap: spacing[12] },
  perkIcon: {
    width: sizes.iconTile,
    height: sizes.iconTile,
    borderRadius: radii.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  perkLabel: { flex: 1 },
  notNow: { minHeight: sizes.touchTarget, alignItems: 'center', justifyContent: 'center' },
  notNowText: { textAlign: 'center' },
  centered: { textAlign: 'center' },
});
