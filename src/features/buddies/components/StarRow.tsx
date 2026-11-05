import { StyleSheet, View } from 'react-native';

import { AppText } from '../../../shared/components/AppText';
import { Icon } from '../../../shared/components/Icon';
import { Pressable } from '../../../shared/components/Pressable';
import { sizes, spacing } from '../../../shared/constants/spacing';
import { useTheme } from '../../../shared/contexts/theme';
import { t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';

export type Trait = 'reliable' | 'safety' | 'company';

const STARS = [1, 2, 3, 4, 5] as const;
const STAR = 28;

type Props = {
  userId: string;
  trait: Trait;
  value: number | null;
  disabled: boolean;
  onChange: (value: number) => void;
};

/** One trait with five stars (buddies AC7); a star sets the score 1–5. */
export function StarRow({ userId, trait, value, disabled, onChange }: Props) {
  const { colors } = useTheme();
  const label = t(`buddies.rate.${trait}`);
  return (
    <View style={layout.row}>
      <AppText variant="small" style={layout.label}>
        {label}
      </AppText>
      <View style={layout.stars} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {STARS.map(n => {
          const lit = value !== null && n <= value;
          return (
            <Pressable
              key={n}
              testID={`rate.${userId}-${trait}-${n}`}
              accessibilityRole="radio"
              accessibilityLabel={t('buddies.rate.star', { trait: label, n })}
              accessibilityState={{ selected: value === n, disabled }}
              disabled={disabled}
              hitSlop={spacing[4]}
              style={layout.star}
              onPress={() => {
                haptics.selection();
                onChange(n);
              }}
            >
              <Icon name="star" color={lit ? colors.gold : colors.line} size={STAR} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const layout = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[8] },
  label: { flexShrink: 1 },
  stars: { flexDirection: 'row' },
  star: { minWidth: sizes.touchTarget - spacing[8], alignItems: 'center', justifyContent: 'center' },
});
