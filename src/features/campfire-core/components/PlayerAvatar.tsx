import { StyleSheet, View } from 'react-native';

import { AppText } from '../../../shared/components/AppText';
import { CompanionArt } from '../../../shared/components/levels/CompanionArt';
import { levelMeta } from '../../../shared/components/levels/levelMeta';
import { Pressable } from '../../../shared/components/Pressable';
import { borders, radii, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles } from '../../../shared/contexts/theme';
import { t } from '../../../shared/i18n';
import { lobbySizes } from '../campTheme';
import { animalLevel } from '../playerProfile';
import type { RosterPlayer } from '../protocol/codec';

type Props = {
  player: RosterPlayer;
  /** Host only, on other players' seats: opens the remove confirm. */
  onLongPress?: () => void;
};

/** One lobby seat: 64 px ring (host orange, others line), name, status; dimmed while reconnecting. */
export function PlayerAvatar({ player, onLongPress }: Props) {
  const styles = useStyles();
  const meta = levelMeta(animalLevel[player.avatar]);
  const reconnecting = player.status === 'reconnecting';
  const name = player.host ? `${player.nickname} ★` : player.nickname;
  const status = player.host
    ? null
    : t(reconnecting ? 'camp.lobby.reconnecting' : 'camp.lobby.waiting');
  const label = status ? `${name}, ${status}` : name;

  const content = (
    <>
      <View
        style={[
          layout.ring,
          { backgroundColor: meta.tint },
          player.host ? styles.hostRing : styles.ring,
        ]}
        importantForAccessibility="no-hide-descendants"
      >
        <CompanionArt
          level={meta.level}
          size={lobbySizes.seat * lobbySizes.seatArtRatio}
        />
      </View>
      <AppText variant="small" tone="ink" numberOfLines={1} style={layout.text}>
        {name}
      </AppText>
      {status ? (
        <AppText
          variant="small"
          tone="muted"
          numberOfLines={1}
          style={layout.text}
        >
          {status}
        </AppText>
      ) : null}
    </>
  );

  const seatStyle = [layout.seat, reconnecting && layout.dimmed];
  const testID = `camp.lobby.player.${player.seatId}`;
  if (!onLongPress) {
    return (
      <View
        testID={testID}
        accessible
        accessibilityLabel={label}
        style={seatStyle}
      >
        {content}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      accessibilityLabel={label}
      accessibilityHint={t('camp.lobby.remove')}
      onLongPress={onLongPress}
      style={seatStyle}
    >
      {content}
    </Pressable>
  );
}

const layout = StyleSheet.create({
  seat: {
    width: lobbySizes.seat + spacing[16],
    alignItems: 'center',
    gap: spacing[4],
  },
  dimmed: { opacity: lobbySizes.dimmed },
  ring: {
    width: lobbySizes.seat,
    height: lobbySizes.seat,
    borderRadius: radii.pill,
    borderWidth: borders.card,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  text: { textAlign: 'center' },
});

const useStyles = createThemedStyles(c => ({
  hostRing: { borderColor: c.orange },
  ring: { borderColor: c.line },
}));
