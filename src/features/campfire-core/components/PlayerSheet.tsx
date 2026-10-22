import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { CompanionArt } from '../../../shared/components/levels/CompanionArt';
import { levelMeta } from '../../../shared/components/levels/levelMeta';
import { Pressable } from '../../../shared/components/Pressable';
import { Sheet } from '../../../shared/components/Sheet';
import { TextField } from '../../../shared/components/TextField';
import { borders, radii, spacing } from '../../../shared/constants/spacing';
import { useAuth } from '../../../shared/contexts/auth';
import { createThemedStyles, ThemeProvider } from '../../../shared/contexts/theme';
import { t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { campScheme, campSizes } from '../campTheme';
import {
  animalLevel,
  animals,
  initialProfile,
  readProfile,
  saveProfile,
  validNickname,
  type Animal,
} from '../playerProfile';

export type CampRole = 'host' | 'join';

type Props = {
  role: CampRole;
  /** Fires after the profile was saved. */
  onContinue: (role: CampRole) => void;
  onDismiss: () => void;
};

const ART_RATIO = 0.8;

/** "Who's playing?" (AC3): nickname + animal, saved to `camp.profile` on Continue. */
export function PlayerSheet({ role, onContinue, onDismiss }: Props) {
  return (
    <Sheet testID="camp.player.sheet" accessibilityLabel={t('camp.player.title')} onDismiss={onDismiss}>
      {/* The sheet renders in a portal, outside the campfire theme scope: pin it again. */}
      <ThemeProvider scheme={campScheme}>
        <PlayerForm role={role} onContinue={onContinue} />
      </ThemeProvider>
    </Sheet>
  );
}

function PlayerForm({ role, onContinue }: Pick<Props, 'role' | 'onContinue'>) {
  const { user } = useAuth();
  const styles = useStyles();
  const [initial] = useState(() => initialProfile(readProfile(), user?.username));
  const [nickname, setNickname] = useState(initial.nickname);
  const [animal, setAnimal] = useState<Animal>(initial.animal);
  const [edited, setEdited] = useState(false);

  const valid = validNickname(nickname);
  const showError = !valid && (edited || nickname.length > 0);

  const pick = (next: Animal) => {
    haptics.selection();
    setAnimal(next);
  };

  const submit = () => {
    if (!valid) {
      return;
    }
    saveProfile({ nickname: valid, animal });
    onContinue(role);
  };

  return (
    <View style={layout.form}>
      <AppText variant="h2" accessibilityRole="header">
        {t('camp.player.title')}
      </AppText>
      <TextField
        testID="camp.player.nickname"
        label={t('camp.player.nickname')}
        value={nickname}
        onChangeText={text => {
          setEdited(true);
          setNickname(text);
        }}
        error={showError ? t('camp.player.nicknameError') : undefined}
        autoCapitalize="words"
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      <AppText variant="chip" tone="ink">
        {t('camp.player.avatar')}
      </AppText>
      <View style={layout.animals} accessibilityRole="radiogroup">
        {animals.map(option => {
          const meta = levelMeta(animalLevel[option]);
          const selected = option === animal;
          return (
            <Pressable
              key={option}
              testID={`camp.player.avatar.${option}`}
              accessibilityLabel={t(`camp.animals.${option}`)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => pick(option)}
              style={[
                layout.chip,
                { backgroundColor: meta.tint },
                selected ? styles.chipSelected : styles.chip,
              ]}
            >
              <CompanionArt level={meta.level} size={campSizes.animalChip * ART_RATIO} />
            </Pressable>
          );
        })}
      </View>
      <AppButton
        testID="camp.player.continue"
        label={t('camp.player.continue')}
        variant="secondary"
        disabled={!valid}
        onPress={submit}
      />
    </View>
  );
}

const layout = StyleSheet.create({
  form: { gap: spacing[16] },
  animals: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[12] },
  chip: {
    width: campSizes.animalChip,
    height: campSizes.animalChip,
    borderRadius: radii.pill,
    borderWidth: borders.card,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});

const useStyles = createThemedStyles(c => ({
  chip: { borderColor: c.line },
  chipSelected: { borderColor: c.orange },
}));
