import { StyleSheet, View } from 'react-native';

import { AppText } from '../../../shared/components/AppText';
import { radii, sizes, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles } from '../../../shared/contexts/theme';
import { t } from '../../../shared/i18n';

/** "Coming soon" pill on CampHub items that ship in a later update. */
export function ComingSoonTag() {
  const styles = useStyles();
  return (
    <View style={[layout.tag, styles.tag]}>
      <AppText variant="caption" tone="muted">
        {t('camp.comingSoon')}
      </AppText>
    </View>
  );
}

const layout = StyleSheet.create({
  tag: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: sizes.chipHeight,
    paddingHorizontal: sizes.chipPaddingHorizontal,
    paddingVertical: spacing[4],
    borderRadius: radii.pill,
  },
});

const useStyles = createThemedStyles(c => ({
  tag: { backgroundColor: c.soft },
}));
