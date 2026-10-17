import { StyleSheet } from 'react-native';

import { Icon } from '../../../shared/components/Icon';
import { Pressable } from '../../../shared/components/Pressable';
import { sizes } from '../../../shared/constants/spacing';
import { useTheme } from '../../../shared/contexts/theme';
import { t } from '../../../shared/i18n';

const ICON = 26;

/** Canvas back arrow: 44 × 44 touch target, 26 px chevron. */
export function BackButton({ onPress, testID = 'auth.back' }: { onPress: () => void; testID?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityLabel={t('auth.back')}
      onPress={onPress}
      style={styles.button}
    >
      <Icon name="back" color={colors.stone} size={ICON} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
