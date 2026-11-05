import { Image, StyleSheet, View } from 'react-native';

import { AppText } from '../../../shared/components/AppText';
import { CompanionArt } from '../../../shared/components/levels/CompanionArt';
import { levelMeta } from '../../../shared/components/levels/levelMeta';
import { borders, radii, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles } from '../../../shared/contexts/theme';

const BADGE = 24;
const RING = 3;

type Props = { avatarUrl: string | null; level: number; size: number };

/** Photo, or the level's companion on its tint, with the level number in the corner (canvas Buddies). */
export function Avatar({ avatarUrl, level, size }: Props) {
  const styles = useStyles();
  const meta = levelMeta(level);
  const circle = { width: size, height: size, borderRadius: size / 2, borderColor: meta.color, backgroundColor: meta.tint };
  return (
    <View style={{ width: size, height: size }}>
      <View style={[layout.circle, circle]}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={layout.photo} />
        ) : (
          <View style={layout.art}>
            <CompanionArt level={meta.level} size={size} />
          </View>
        )}
      </View>
      <View style={[layout.badge, styles.badgeBorder, { backgroundColor: meta.color }]}>
        <AppText variant="caption" tone="white">
          {meta.level}
        </AppText>
      </View>
    </View>
  );
}

const layout = StyleSheet.create({
  circle: { borderWidth: RING, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  photo: { width: '100%', height: '100%' },
  art: { marginTop: spacing[12] },
  badge: {
    position: 'absolute',
    right: -spacing[4],
    bottom: -spacing[4],
    width: BADGE,
    height: BADGE,
    borderRadius: radii.checkbox,
    borderWidth: borders.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const useStyles = createThemedStyles(c => ({
  badgeBorder: { borderColor: c.card },
}));
