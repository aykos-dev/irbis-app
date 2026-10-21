import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { AppText } from '../../../shared/components/AppText';
import { Pressable } from '../../../shared/components/Pressable';
import { palette } from '../../../shared/constants/colors';
import { borders, radii, sizes, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles } from '../../../shared/contexts/theme';
import { t } from '../../../shared/i18n';
import { campSizes, gameColors, type GameId } from '../campTheme';
import { CrocGlyph } from '../games/croc/CrocGlyph';
import { XoGlyph } from '../games/xo/XoGlyph';

const VIEWBOX = '0 0 24 24';

/** Simple white glyph per game: mask, hat, question mark, split arrows, an X and an O, croc jaw. */
function GameGlyph({ game }: { game: GameId }) {
  const stroke = {
    stroke: palette.white,
    strokeWidth: sizes.iconStroke,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };
  const size = campSizes.gameGlyph;
  switch (game) {
    case 'imposter':
      return (
        <Svg width={size} height={size} viewBox={VIEWBOX}>
          <Path d="M3 7c3-2.5 15-2.5 18 0c0 6-4 10.5-9 10.5S3 13 3 7z" {...stroke} />
          <Circle cx="8.5" cy="10" r="1.6" fill={palette.white} />
          <Circle cx="15.5" cy="10" r="1.6" fill={palette.white} />
        </Svg>
      );
    case 'mafia':
      return (
        <Svg width={size} height={size} viewBox={VIEWBOX}>
          <Path d="M3 17.5h18" {...stroke} />
          <Path d="M6.5 17.5l1.2-9c2.6-1.6 6-1.6 8.6 0l1.2 9" {...stroke} />
          <Path d="M7 14h10" {...stroke} />
        </Svg>
      );
    case 'whoami':
      return (
        <Svg width={size} height={size} viewBox={VIEWBOX}>
          <Path d="M8.5 8.5a3.5 3.5 0 1 1 5 3.2c-.9.4-1.5 1.2-1.5 2.2V15" {...stroke} />
          <Circle cx="12" cy="19" r="1.4" fill={palette.white} />
        </Svg>
      );
    case 'rather':
      return (
        <Svg width={size} height={size} viewBox={VIEWBOX}>
          <Path d="M12 21v-6L6 9M12 15l6-6" {...stroke} />
          <Path d="M6 13V9h4M18 13V9h-4" {...stroke} />
        </Svg>
      );
    case 'xo':
      return <XoGlyph size={size} />;
    case 'croc':
      return <CrocGlyph size={size} />;
  }
}

type Props = {
  game: GameId;
  onPress: () => void;
};

/** One CampHub game tile (AC2): icon, name, players · length (every game is live since campfire-mafia). */
export function GameTile({ game, onPress }: Props) {
  const styles = useStyles();
  const name = t(`camp.games.${game}`);
  const meta = t(`camp.games.${game}Meta`);
  return (
    <Pressable
      testID={`camp.hub.game.${game}`}
      accessibilityLabel={`${name}, ${meta}`}
      onPress={onPress}
      style={[layout.tile, styles.tile]}
    >
      <View style={[layout.icon, { backgroundColor: gameColors[game] }]}>
        <GameGlyph game={game} />
      </View>
      <AppText variant="h3">{name}</AppText>
      <AppText variant="small">{meta}</AppText>
    </Pressable>
  );
}

const layout = StyleSheet.create({
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    gap: spacing[6],
    padding: spacing[14],
    borderRadius: radii.card,
    borderWidth: borders.card,
  },
  icon: {
    width: campSizes.gameIcon,
    height: campSizes.gameIcon,
    borderRadius: radii.tile,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
});

const useStyles = createThemedStyles(c => ({
  tile: { backgroundColor: c.card, borderColor: c.line },
}));
