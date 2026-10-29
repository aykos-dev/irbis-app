import { Icon } from '../../../shared/components/Icon';
import { ListCard, ListRow } from '../../../shared/components/ListRow';
import { streakColors } from '../../../shared/constants/colors';
import { useTheme } from '../../../shared/contexts/theme';
import { t } from '../../../shared/i18n';
import { useStreaks } from '../hooks/useStreaks';

const ROW_ICON = 22;

/** Account Profile streak row (AC7): flame + boot counts; nothing until the streaks load. */
export function ProfileStreaksCard() {
  const { colors } = useTheme();
  const { signedIn, data } = useStreaks();
  if (!signedIn || !data) {
    return null;
  }
  const { flame, boot } = data;
  return (
    <ListCard>
      <ListRow
        testID="profile.streaks"
        first
        label={t('streaks.profile.label')}
        value={t('streaks.profile.value', { flame: flame.count, boot: boot.count })}
        icon={<Icon name="flame" color={flame.doneToday ? streakColors.flame : colors.stone} size={ROW_ICON} />}
      />
    </ListCard>
  );
}
