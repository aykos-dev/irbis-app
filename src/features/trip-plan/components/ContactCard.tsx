import { StyleSheet, View } from 'react-native';

import type { EmergencyContactDto } from '../../../shared/api/generated/model';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { ErrorState } from '../../../shared/components/ErrorState';
import { Pressable } from '../../../shared/components/Pressable';
import { Skeleton } from '../../../shared/components/Skeleton';
import { borders, radii, sizes, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles } from '../../../shared/contexts/theme';
import { t } from '../../../shared/i18n';

const SKELETON_HEIGHT = 72;

type Props = {
  contact: EmergencyContactDto | null;
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  onEdit: () => void;
};

/** Emergency contact (AC4): saved contact with Change, or "Add emergency contact". */
export function ContactCard({ contact, loading, error, onRetry, onEdit }: Props) {
  const styles = useStyles();

  let body;
  if (contact) {
    body = (
      <View style={layout.row}>
        <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <AppText variant="h3" tone="white">
            {contact.name.slice(0, 1).toUpperCase()}
          </AppText>
        </View>
        <View style={layout.text}>
          <AppText testID="trip.contact.summary" variant="body" tone="ink">
            {`${contact.name} · ${contact.relation}`}
          </AppText>
          <AppText variant="small">{t('trip.contactLine', { phone: contact.phoneMasked })}</AppText>
        </View>
        <Pressable
          testID="trip.contact.change"
          accessibilityRole="button"
          accessibilityLabel={t('trip.contactChange')}
          onPress={onEdit}
          style={layout.change}
        >
          <AppText variant="small" tone="teal700">
            {t('trip.contactChange')}
          </AppText>
        </Pressable>
      </View>
    );
  } else if (loading) {
    body = <Skeleton height={SKELETON_HEIGHT} radius={radii.tile} />;
  } else if (error) {
    body = <ErrorState testID="trip.contact.load-error" retryTestID="trip.contact.retry" error={error} onRetry={onRetry} />;
  } else {
    body = (
      <AppButton testID="trip.contact.add" variant="white" label={t('trip.contactAdd')} onPress={onEdit} />
    );
  }

  return (
    <View testID="trip.contact" style={styles.card}>
      <AppText variant="caption">{t('trip.contact')}</AppText>
      {body}
    </View>
  );
}

const layout = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[12] },
  text: { flex: 1, gap: spacing[4] },
  change: { minHeight: sizes.touchTarget, justifyContent: 'center', paddingHorizontal: spacing[8] },
});

const useStyles = createThemedStyles(c => ({
  card: {
    gap: spacing[12],
    padding: spacing[16],
    borderRadius: radii.card,
    borderWidth: borders.card,
    borderColor: c.line,
    backgroundColor: c.card,
  },
  avatar: {
    width: sizes.placeTypeDot,
    height: sizes.placeTypeDot,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.teal700,
  },
}));
