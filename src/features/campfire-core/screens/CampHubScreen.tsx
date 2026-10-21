import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { foxCheering } from '../../../assets/images/campfire';
import { placeHeroes } from '../../../assets/images/places';
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
import { IosHotspotGuide } from '../components/IosHotspotGuide';
import { PlayerSheet, type CampRole } from '../components/PlayerSheet';
import { hostsWithGuide } from '../native/hostPlatform';
import { loadHostRoom } from '../room/hostRoomStore';

const games: GameId[] = ['imposter', 'mafia', 'whoami', 'rather', 'xo'];

/**
 * CampHub (AC2), the Campfire segment of Community: works offline and as a guest, no network.
 * Host / Join open the player sheet (AC3); a game tile hosts that game; "Coming soon" cards toast.
 */
export function CampHubScreen() {
  const navigation = useNavigation();
  const { show } = useToast();
  const styles = useStyles();
  const [sheet, setSheet] = useState<CampRole | null>(null);
  const [guide, setGuide] = useState(false);
  const [savedCode, setSavedCode] = useState<string | null>(null);
  /** A game tile starts the Host flow with that game preselected (campfire-party / campfire-mafia AC1). */
  const [hostGame, setHostGame] = useState<GameId | undefined>(undefined);

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

  // An iPhone can't start a hotspot itself: the host turns it on first (AC4).
  const onContinue = (role: CampRole) => {
    setSheet(null);
    if (role === 'host' && hostsWithGuide()) {
      setGuide(true);
      return;
    }
    if (role === 'host') {
      navigation.navigate('CampLobby', hostGame ? { game: hostGame } : undefined);
    } else {
      navigation.navigate('CampJoin');
    }
  };

  const onHotspotReady = () => {
    setGuide(false);
    navigation.navigate('CampLobby', hostGame ? { game: hostGame } : undefined);
  };

  const openSheet = (role: CampRole, game?: GameId) => {
    setHostGame(game);
    setSheet(role);
  };

  const onGame = (game: GameId) => {
    haptics.tap();
    openSheet('host', game);
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
            <Image source={foxCheering} style={layout.heroFox} accessibilityIgnoresInvertColors />
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
          <AppButton testID="camp.hub.host" label={t('camp.hub.host')} variant="secondary" onPress={() => openSheet('host')} />
        </View>
        <View style={layout.flex}>
          <AppButton testID="camp.hub.join" label={t('camp.hub.join')} variant="white" onPress={() => openSheet('join')} />
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
          <GameTile key={game} game={game} onPress={() => onGame(game)} />
        ))}
      </View>

      <TaggedCard testID="camp.hub.trip-group" label={t('camp.hub.tripGroup')} onPress={comingSoon} />
      <TaggedCard testID="camp.hub.badges" label={t('camp.hub.badges')} onPress={comingSoon} />

      {sheet ? <PlayerSheet role={sheet} onContinue={onContinue} onDismiss={() => setSheet(null)} /> : null}
      {guide ? <IosHotspotGuide onReady={onHotspotReady} onDismiss={() => setGuide(false)} /> : null}
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
  heroFox: { width: campSizes.heroArt, height: campSizes.heroArt },
  heroText: { padding: spacing[16], gap: spacing[6] },
  buttons: { flexDirection: 'row', gap: spacing[12] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[12] },
});

const useStyles = createThemedStyles(c => ({
  card: { backgroundColor: c.card, borderColor: c.line },
}));
