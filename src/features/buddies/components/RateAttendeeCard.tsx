import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { RatingAttendeeDto, TripRatingScoresDto } from '../../../shared/api/generated/model';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { borders, radii, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles } from '../../../shared/contexts/theme';
import { t } from '../../../shared/i18n';
import { personName } from '../labels';
import { Avatar } from './Avatar';
import { StarRow, type Trait } from './StarRow';

const AVATAR = 48;
const TRAITS: readonly Trait[] = ['reliable', 'safety', 'company'];

type Draft = Record<Trait, number | null>;

type Props = {
  attendee: RatingAttendeeDto;
  /** Closed or offline: stars and Save are disabled. */
  readOnly: boolean;
  saving: boolean;
  onSave: (scores: TripRatingScoresDto) => Promise<boolean>;
};

const fromScores = (scores: TripRatingScoresDto | null): Draft => ({
  reliable: scores?.reliable ?? null,
  safety: scores?.safety ?? null,
  company: scores?.company ?? null,
});

/** One attendee: avatar, name, three star rows and Save (buddies AC7). */
export function RateAttendeeCard({ attendee, readOnly, saving, onSave }: Props) {
  const styles = useStyles();
  const [draft, setDraft] = useState<Draft>(() => fromScores(attendee.myScores));
  // Saved until a star changes again; a person rated earlier starts as saved.
  const [saved, setSaved] = useState(attendee.myScores !== null);
  const { reliable, safety, company } = draft;
  const complete = reliable !== null && safety !== null && company !== null;

  const save = async () => {
    if (reliable === null || safety === null || company === null) {
      return;
    }
    if (await onSave({ reliable, safety, company })) {
      setSaved(true);
    }
  };

  return (
    <View testID={`rate.card-${attendee.userId}`} style={[layout.card, styles.card]}>
      <View style={layout.person}>
        <Avatar avatarUrl={attendee.avatarUrl} level={attendee.level} size={AVATAR} />
        <AppText variant="h3" style={layout.name}>
          {personName(attendee)}
        </AppText>
      </View>
      {TRAITS.map(trait => (
        <StarRow
          key={trait}
          userId={attendee.userId}
          trait={trait}
          value={draft[trait]}
          disabled={readOnly}
          onChange={value => {
            setDraft(current => ({ ...current, [trait]: value }));
            setSaved(false);
          }}
        />
      ))}
      {readOnly ? null : (
        <AppButton
          testID={`rate.save-${attendee.userId}`}
          label={t(saved ? 'buddies.rate.saved' : 'buddies.rate.save')}
          variant={saved ? 'secondary' : 'primary'}
          disabled={!complete || saved}
          loading={saving}
          onPress={() => void save()}
        />
      )}
    </View>
  );
}

const layout = StyleSheet.create({
  card: { borderRadius: radii.card, borderWidth: borders.card, padding: spacing[16], gap: spacing[12] },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing[12] },
  name: { flexShrink: 1 },
});

const useStyles = createThemedStyles(c => ({
  card: { backgroundColor: c.card, borderColor: c.line },
}));
