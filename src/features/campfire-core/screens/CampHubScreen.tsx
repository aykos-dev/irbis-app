import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { placeHeroes } from '../../../assets/images/places';
import { companionFoxSvg } from '../../../assets/svg/companionFox';
import { pandaCheeringSvg } from '../../../assets/svg/pandaCheering';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { Pressable } from '../../../shared/components/Pressable';
import { StatusChip } from '../../../shared/components/StatusChip';
import { useToast } from '../../../shared/components/Toast';
import { borders, radii, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles } from '../../../shared/contexts/theme';
import { t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { campSizes, type GameId } from '../campTheme';
import { ComingSoonTag } from '../components/ComingSoonTag';
import { GameTile } from '../components/GameTile';
import { PlayerSheet, type CampRole } from '../components/PlayerSheet';
import { loadHostRoom } from '../room/hostRoomStore';

const games: GameId[] = ['imposter', 'mafia', 'whoami', 'rather'];

/**
 * CampHub (AC2), the Campfire segment of Community: works offline and as a guest, no network.
 * Host / Join open the player sheet (AC3); everything tagged "Coming soon" shows a toast.
 */
export function CampHubScreen() {
  const navigation = useNavigation();
  const { show } = useToast();
  const styles = useStyles();
  const [sheet, setSheet] = useState<CampRole | null>(null);
  const [savedCode, setSavedCode] = useState<string | null>(null);

  // A room hosted in the last 12 h can be resumed (AC7); re-read whenever the hub is back in view.
  useFocusEffect(
    useCallback(() => {
      setSavedCode(loadHostRoom()?.code ?? null);
    }, []),
  );

  const comingSoon = () => {
    haptics.tap();
    show({ variant: 'info', message: t('camp.comingSoonToast') });
  };

  const onContinue = (role: CampRole) => {
    setSheet(null);
    navigation.navigate(role === 'host' ? 'CampLobby' : 'CampJoin');
  };

  return (
    <View testID="camp.hub.screen" style={layout.root}>
      <View style={layout.header}>
        <AppText variant="h1" accessibilityRole="header" style={layout.flex}>
          {t('camp.hub.title')}
        </AppText>
        <StatusChip testID="camp.hub.offline" variant="go" label={t('camp.hub.offline')} />
      </View>

      <View style={[layout.card, styles.card]}>
        <View style={layout.hero}>
          <Image source={placeHeroes.camping} style={layout.heroImage} accessibilityIgnoresInvertColors />
          <View style={layout.heroArt} importantForAccessibility="no-hide-descendants">
            <SvgXml xml={pandaCheeringSvg} width={campSizes.heroArt} height={campSizes.heroArt} />
            <SvgXml xml={companionFoxSvg} width={campSizes.heroArt} height={campSizes.heroArt} />
          </View>
        </View>
        <View style={layout.heroText}>
          <AppText variant="h2">{t('camp.hub.heroTitle')}</AppText>
          <AppText variant="body" tone="muted">
            {t('camp.hub.heroBody')}
          </AppText>
        </View>
      </View>

      <View style={layout.buttons}>
        <View style={layout.flex}>
          <AppButton testID="camp.hub.host" label={t('camp.hub.host')} variant="secondary" onPress={() => setSheet('host')} />
        </View>
        <View style={layout.flex}>
          <AppButton testID="camp.hub.join" label={t('camp.hub.join')} variant="white" onPress={() => setSheet('join')} />
        </View>
      </View>
      {savedCode ? (
        <AppButton
          testID="camp.hub.resume"
          label={t('camp.hub.resume', { code: savedCode })}
          variant="primary"
          onPress={() => navigation.navigate('CampLobby', { resume: true })}
        />
      ) : null}

      <AppText variant="h3" accessibilityRole="header">
        {t('camp.hub.games')}
      </AppText>
      <View style={layout.grid}>
        {games.map(game => (
          <GameTile key={game} game={game} onPress={comingSoon} />
        ))}
      </View>

      <TaggedCard testID="camp.hub.trip-group" label={t('camp.hub.tripGroup')} onPress={comingSoon} />
      <TaggedCard testID="camp.hub.badges" label={t('camp.hub.badges')} onPress={comingSoon} />

      {sheet ? <PlayerSheet role={sheet} onContinue={onContinue} onDismiss={() => setSheet(null)} /> : null}
    </View>
  );
}

function TaggedCard({ testID, label, onPress }: { testID: string; label: string; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable
      testID={testID}
      accessibilityLabel={`${label}, ${t('camp.comingSoon')}`}
      onPress={onPress}
      style={[layout.card, layout.row, styles.card]}
    >
      <AppText variant="h3" style={layout.flex}>
        {label}
      </AppText>
      <ComingSoonTag />
    </Pressable>
  );
}

const layout = StyleSheet.create({
  root: { gap: spacing[16] },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[12] },
  card: {
    borderRadius: radii.card,
    borderWidth: borders.card,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    padding: spacing[16],
  },
  hero: { height: campSizes.heroHeight },
  heroImage: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  heroArt: {
    position: 'absolute',
    bottom: 0,
    start: spacing[16],
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  heroText: { padding: spacing[16], gap: spacing[6] },
  buttons: { flexDirection: 'row', gap: spacing[12] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[12] },
});

const useStyles = createThemedStyles(c => ({
  card: { backgroundColor: c.card, borderColor: c.line },
}));
