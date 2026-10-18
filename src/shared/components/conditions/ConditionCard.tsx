import { StyleSheet, View } from 'react-native';

import type { PlaceConditionDto } from '../../api/generated/model';
import { conditionColors } from '../../constants/colors';
import { borders, radii, sizes, spacing } from '../../constants/spacing';
import { createThemedStyles } from '../../contexts/theme';
import { t, type Locale } from '../../i18n';
import { AppButton } from '../AppButton';
import { AppText } from '../AppText';
import { Mascot } from '../Mascot';
import { Skeleton } from '../Skeleton';
import { StatusChip } from '../StatusChip';
import { conditionLines, conditionTitle, statusVariant, updatedAgo } from './reasonText';

const SKELETON_HEIGHT = 96;

type Props = {
  condition: PlaceConditionDto | undefined;
  /** The fetch failed and nothing is cached. */
  error: unknown;
  isOnline: boolean;
  onRetry: () => void;
  locale: Locale;
  /** Clock for the "Updated" age; tests pass a fixed one. */
  now?: Date;
};

/**
 * Weekend condition card (AC7, AC8): status chip + title, "Updated … · source", up to three
 * reasons; grey when there is no status yet. Without data: error or offline with "Try again",
 * otherwise a skeleton. Cached data stays visible offline with its age.
 */
export function ConditionCard({ condition, error, isOnline, onRetry, locale, now }: Props) {
  if (condition) {
    return <Loaded condition={condition} locale={locale} now={now ?? new Date()} />;
  }
  if (error || !isOnline) {
    return (
      <Problem
        testID={error ? 'place.condition-error' : 'place.condition-offline'}
        message={t(error ? 'conditions.error' : 'conditions.offline')}
        onRetry={onRetry}
      />
    );
  }
  return <Skeleton testID="place.condition-skeleton" height={SKELETON_HEIGHT} radius={radii.card} />;
}

function Problem({ testID, message, onRetry }: { testID: string; message: string; onRetry: () => void }) {
  const styles = useStyles();
  return (
    <View testID={testID} style={[styles.card, styles.empty]}>
      <AppText variant="body" accessibilityRole="alert">
        {message}
      </AppText>
      <AppButton
        testID="place.condition-retry"
        label={t('conditions.retry')}
        variant="white"
        onPress={onRetry}
      />
    </View>
  );
}

function Loaded({ condition, locale, now }: { condition: PlaceConditionDto; locale: Locale; now: Date }) {
  const styles = useStyles();
  const { status, source, computedAt } = condition;

  if (!status) {
    return (
      <View testID="place.condition-empty" style={[styles.card, styles.empty]} accessible>
        <AppText variant="body" tone="muted">
          {t('conditions.empty')}
        </AppText>
      </View>
    );
  }

  const variant = statusVariant[status];
  const title = conditionTitle(status, condition.opensMonth, locale);
  const lines = conditionLines(condition, locale);
  const updated =
    computedAt && source
      ? t('conditions.updated', {
          time: updatedAgo(computedAt, now),
          source: t(`conditions.source.${source}`),
        })
      : null;

  return (
    <View
      testID="place.condition"
      style={[styles.card, { borderColor: conditionColors[variant].ring }]}
    >
      <View style={layout.text}>
        <StatusChip
          testID="place.condition-status"
          variant={variant}
          label={t(`conditions.status.${status}`)}
        />
        <AppText testID="place.condition-title" variant="h3" accessibilityRole="header">
          {title}
        </AppText>
        {updated ? (
          <AppText testID="place.condition-updated" variant="small" tone="muted">
            {updated}
          </AppText>
        ) : null}
        {lines.map((line, index) => (
          <AppText key={index} testID={`place.condition-reason.${index + 1}`} variant="body">
            {line}
          </AppText>
        ))}
      </View>
      {status === 'not_now' ? (
        <View testID="place.condition-mascot">
          <Mascot kind="worried" size={sizes.mascotCard} />
        </View>
      ) : null}
    </View>
  );
}

const layout = StyleSheet.create({
  text: { flex: 1, gap: spacing[8] },
});

const useStyles = createThemedStyles(c => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    padding: spacing[16],
    borderRadius: radii.card,
    borderWidth: borders.card,
    borderBottomWidth: borders.edge,
    borderColor: c.line,
    backgroundColor: c.card,
  },
  empty: {
    flexDirection: 'column',
    alignItems: 'stretch',
    backgroundColor: c.soft,
  },
}));
