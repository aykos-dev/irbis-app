import { StyleSheet } from 'react-native';

import { AppText } from '../../../shared/components/AppText';
import { Pressable } from '../../../shared/components/Pressable';
import { sizes, spacing } from '../../../shared/constants/spacing';
import { fontFamily } from '../../../shared/constants/typography';
import { haptics } from '../../../shared/utils/haptics';

type Props = {
  label: string;
  onPress: () => void;
  testID: string;
  align?: 'start' | 'end' | 'center';
};

/** Canvas `.lnk`: 15 / 900 teal-700, min 44 px touch height. */
export function TextLink({ label, onPress, testID, align = 'start' }: Props) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      style={[styles.link, alignment[align]]}
    >
      <AppText variant="body" tone="teal700" style={styles.text}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { minHeight: sizes.touchTarget, justifyContent: 'center', paddingHorizontal: spacing[4] },
  text: { fontFamily: fontFamily.black },
});

const alignment = StyleSheet.create({
  start: { alignSelf: 'flex-start' },
  end: { alignSelf: 'flex-end' },
  center: { alignSelf: 'center' },
});
