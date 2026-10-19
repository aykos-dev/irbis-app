import { StyleSheet, View } from 'react-native';

import { CompanionArt } from '../../../../shared/components/levels/CompanionArt';
import { levelMeta } from '../../../../shared/components/levels/levelMeta';
import { borders, radii } from '../../../../shared/constants/spacing';
import { createThemedStyles } from '../../../../shared/contexts/theme';
import { partySizes } from '../../campTheme';
import { animalLevel, type Animal } from '../../playerProfile';

type Props = { avatar: Animal; size: number };

/** A player's animal in a round ring (decorative: the name next to it carries the label). */
export function SeatAvatar({ avatar, size }: Props) {
  const styles = useStyles();
  const meta = levelMeta(animalLevel[avatar]);
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[
        layout.ring,
        styles.ring,
        { width: size, height: size, backgroundColor: meta.tint },
      ]}
    >
      <CompanionArt level={meta.level} size={size * partySizes.avatarArtRatio} />
    </View>
  );
}

const layout = StyleSheet.create({
  ring: {
    borderRadius: radii.pill,
    borderWidth: borders.card,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});

const useStyles = createThemedStyles(c => ({
  ring: { borderColor: c.line },
}));
