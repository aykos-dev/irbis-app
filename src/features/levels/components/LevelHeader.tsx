import { StyleSheet, View } from 'react-native';

import { AppText } from '../../../shared/components/AppText';
import { Icon } from '../../../shared/components/Icon';
import { Pressable } from '../../../shared/components/Pressable';
import { borders, radii, sizes, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles, useTheme } from '../../../shared/contexts/theme';
import { t } from '../../../shared/i18n';

type Props = {
  title: string;
  onBack: () => void;
  backTestID: string;
};

/** Back button and screen title (canvas Level, Companions). */
export function LevelHeader({ title, onBack, backTestID }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={layout.row}>
      <Pressable
        testID={backTestID}
        accessibilityRole="button"
        accessibilityLabel={t('places.back')}
        onPress={onBack}
        style={styles.back}
      >
        <Icon name="back" color={colors.ink} />
      </Pressable>
      <AppText variant="h2" accessibilityRole="header" style={layout.title}>
        {title}
      </AppText>
    </View>
  );
}

const layout = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[12] },
  title: { flex: 1 },
});

const useStyles = createThemedStyles(c => ({
  back: {
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.card,
    borderWidth: borders.card,
    borderColor: c.line,
  },
}));
