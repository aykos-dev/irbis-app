import { StyleSheet, View } from 'react-native';

import type { HazardLevel, HazardLevelDto } from '../../api/generated/model';
import { spacing } from '../../constants/spacing';
import { t } from '../../i18n';
import { AppText } from '../AppText';
import { StatusChip, type StatusChipVariant } from '../StatusChip';

const levelVariant: Record<HazardLevel, StatusChipVariant> = {
  low: 'go',
  raised: 'caution',
  high: 'notNow',
  open: 'go',
  closed: 'notNow',
};

/** "Hazards now" (AC7): each hazard with its current level. The caller keeps the empty copy. */
export function HazardsNow({ hazards }: { hazards: HazardLevelDto[] }) {
  return (
    <View testID="place.hazards-now" style={layout.list}>
      <AppText variant="h3" accessibilityRole="header">
        {t('conditions.hazards.title')}
      </AppText>
      {hazards.map(({ hazard, level }) => {
        const name = t(`places.hazard.${hazard}`);
        const levelLabel = t(`conditions.level.${level}`);
        return (
          <View
            key={hazard}
            testID={`place.hazard.${hazard}`}
            style={layout.row}
            accessible
            accessibilityLabel={`${name}: ${levelLabel}`}
          >
            <AppText variant="body" style={layout.name}>
              {name}
            </AppText>
            <StatusChip
              testID={`place.hazard.${hazard}.level`}
              variant={levelVariant[level]}
              label={levelLabel}
            />
          </View>
        );
      })}
    </View>
  );
}

const layout = StyleSheet.create({
  list: { gap: spacing[12] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[12] },
  name: { flexShrink: 1 },
});
