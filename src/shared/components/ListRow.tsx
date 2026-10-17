import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { borders, radii, spacing } from '../constants/spacing';
import { createThemedStyles } from '../contexts/theme';
import { AppText } from './AppText';
import { Pressable } from './Pressable';

/** Canvas card list (AccGuestProfile .card + .row): 2 px border, 4 px bottom edge, radius 20. */
export function ListCard({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return <View style={[layout.card, styles.card]}>{children}</View>;
}

type Props = {
  testID: string;
  label: string;
  icon: ReactNode;
  /** Right-hand value (current language, "Verified"). */
  value?: string;
  /** Trailing element after the value (chevron, badge). */
  trailing?: ReactNode;
  onPress?: () => void;
  /** First row has no top divider. */
  first?: boolean;
  accessibilityHint?: string;
};

export function ListRow({ testID, label, icon, value, trailing, onPress, first, accessibilityHint }: Props) {
  const styles = useStyles();
  const content = (
    <>
      {icon}
      <AppText variant="h3" style={layout.label}>
        {label}
      </AppText>
      {value ? <AppText variant="small">{value}</AppText> : null}
      {trailing}
    </>
  );
  const rowStyle = [layout.row, first ? null : styles.divider];

  if (!onPress) {
    return (
      <View testID={testID} accessible accessibilityLabel={value ? `${label}, ${value}` : label} style={rowStyle}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      accessibilityLabel={value ? `${label}, ${value}` : label}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={rowStyle}
    >
      {content}
    </Pressable>
  );
}

const layout = StyleSheet.create({
  card: {
    borderWidth: borders.card,
    borderBottomWidth: borders.edge,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    paddingVertical: spacing[14],
    paddingHorizontal: spacing[16],
  },
  label: { flex: 1 },
});

const useStyles = createThemedStyles(c => ({
  card: { backgroundColor: c.card, borderColor: c.line },
  divider: { borderTopWidth: borders.card, borderTopColor: c.soft },
}));
