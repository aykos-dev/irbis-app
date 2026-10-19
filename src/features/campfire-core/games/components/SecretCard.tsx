import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '../../../../shared/components/AppText';
import { Pressable } from '../../../../shared/components/Pressable';
import { borders, radii, spacing } from '../../../../shared/constants/spacing';
import { createThemedStyles } from '../../../../shared/contexts/theme';
import { t } from '../../../../shared/i18n';
import { haptics } from '../../../../shared/utils/haptics';
import { secretSizes } from '../../campTheme';

type Props = {
  /** The secret, rendered only while the card is held. */
  children: ReactNode;
  /** iOS screen recording or mirroring: a solid cover, the secret can't be shown. */
  captured: boolean;
  /** Called on every release after a reveal. */
  onHide?: () => void;
};

/**
 * Hold to reveal (AC3): covered until pressed, the secret while the finger is down, covered again on
 * release. A light haptic on show.
 */
export function SecretCard({ children, captured, onHide }: Props) {
  const styles = useStyles();
  const [shown, setShown] = useState(false);
  const open = shown && !captured;

  if (captured) {
    return (
      <View
        testID="camp.secret.card"
        accessible
        accessibilityLabel={t('camp.secret.recording')}
        style={[layout.card, layout.covered, styles.cover]}
      >
        <AppText variant="h3" tone="muted" style={layout.center}>
          {t('camp.secret.recording')}
        </AppText>
      </View>
    );
  }

  return (
    <Pressable
      testID="camp.secret.card"
      accessibilityRole="button"
      accessibilityLabel={t(open ? 'camp.secret.release' : 'camp.secret.hold')}
      feedback="none"
      onPressIn={() => {
        haptics.tap();
        setShown(true);
      }}
      onPressOut={() => {
        setShown(false);
        onHide?.();
      }}
      style={[layout.card, open ? styles.open : [layout.covered, styles.cover]]}
    >
      {open ? children : null}
      <AppText variant="small" tone="muted" style={layout.center}>
        {t(open ? 'camp.secret.release' : 'camp.secret.hold')}
      </AppText>
    </Pressable>
  );
}

const layout = StyleSheet.create({
  card: {
    minHeight: secretSizes.cardMinHeight,
    borderRadius: radii.largeCard,
    borderWidth: borders.card,
    borderBottomWidth: borders.edge,
    padding: spacing[20],
    gap: spacing[12],
    overflow: 'hidden',
  },
  covered: { alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
});

const useStyles = createThemedStyles(c => ({
  cover: { backgroundColor: c.soft, borderColor: c.line },
  open: { backgroundColor: c.card, borderColor: c.line },
}));
