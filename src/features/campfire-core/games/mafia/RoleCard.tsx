import { Image, StyleSheet, View } from 'react-native';

import { roleCards } from '../../../../assets/images/campfire';
import { AppButton } from '../../../../shared/components/AppButton';
import { AppText } from '../../../../shared/components/AppText';
import { radii, spacing } from '../../../../shared/constants/spacing';
import { t } from '../../../../shared/i18n';
import { mafiaSizes } from '../../campTheme';
import { SecretCard } from '../components/SecretCard';
import { useSecureScreen } from '../useSecureScreen';
import { roles, teamOf, type RoleId } from './roles';

type Props = {
  roleId: RoleId;
  seat: number;
  nickname: string;
  readyCount: number;
  playerCount: number;
  /** This phone already sent `mafReady`. */
  ready: boolean;
  onReady: () => void;
};

/**
 * The player's role (AC3): covered card held to look, then the role, its team and what to do at
 * night, by day and to win. The screen is secure while it shows. "I'm ready" is sent once.
 */
export function RoleCard({
  roleId,
  seat,
  nickname,
  readyCount,
  playerCount,
  ready,
  onReady,
}: Props) {
  const { captured } = useSecureScreen();
  const role = roles.find(entry => entry.id === roleId);
  const team = teamOf(roleId);
  const counts = { r: readyCount, n: playerCount };

  return (
    <View style={layout.root}>
      <View style={layout.header}>
        <AppText variant="caption">
          {t('camp.maf.cardHeader', { n: playerCount })}
        </AppText>
        <AppText variant="small">
          {t('camp.maf.seat', { k: seat, name: nickname })}
        </AppText>
        <AppText variant="h2" accessibilityRole="header">
          {t('camp.maf.roleReady')}
        </AppText>
        <AppText variant="small">{t('camp.maf.readyHint')}</AppText>
      </View>
      <View testID="maf.card">
        <SecretCard captured={captured}>
          <View style={layout.center}>
            <AppText variant="caption">{t('camp.maf.youAre')}</AppText>
            <Image
              testID="maf.card.art"
              source={roleCards[roleId]}
              style={layout.art}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              accessibilityIgnoresInvertColors
            />
            <AppText
              variant="h1"
              style={[layout.centerText, { color: role?.color }]}
            >
              {t(`camp.maf.role.${roleId}.name`)}
            </AppText>
            <AppText variant="chip">
              {t('camp.maf.teamLine', {
                team: t(`camp.maf.team.${team}.name`),
              })}
            </AppText>
          </View>
          <AppText variant="body">{t(`camp.maf.role.${roleId}.night`)}</AppText>
          <AppText variant="body">{t(`camp.maf.team.${team}.day`)}</AppText>
          <AppText variant="body">{t(`camp.maf.team.${team}.win`)}</AppText>
        </SecretCard>
      </View>
      <AppButton
        testID="maf.ready"
        label={t(ready ? 'camp.maf.readyDone' : 'camp.maf.imReady', counts)}
        disabled={ready}
        onPress={onReady}
      />
    </View>
  );
}

const layout = StyleSheet.create({
  root: { gap: spacing[16] },
  header: { gap: spacing[6] },
  center: { alignItems: 'center', gap: spacing[8] },
  centerText: { textAlign: 'center' },
  art: {
    width: mafiaSizes.cardArtWidth,
    height: mafiaSizes.cardArtHeight,
    borderRadius: radii.tile,
  },
});
