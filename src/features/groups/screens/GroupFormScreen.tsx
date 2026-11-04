import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  getGroupsGetQueryKey,
  getGroupsListQueryKey,
  useGroupsCreate,
  useGroupsGet,
  useGroupsUpdate,
} from '../../../shared/api/generated/groups/groups';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { Icon } from '../../../shared/components/Icon';
import { Pressable } from '../../../shared/components/Pressable';
import { Screen } from '../../../shared/components/Screen';
import { TextField } from '../../../shared/components/TextField';
import { toast } from '../../../shared/components/toastBus';
import { borders, radii, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles, useTheme } from '../../../shared/contexts/theme';
import { t } from '../../../shared/i18n';
import type { RootStackScreenProps } from '../../../app/navigation/types';

type Props = RootStackScreenProps<'CreateGroup'> | RootStackScreenProps<'EditGroup'>;

export function GroupFormScreen({ navigation, route }: Props) {
  const editId = route.name === 'EditGroup' ? route.params.id : null;
  const details = useGroupsGet(editId ?? '', { query: { enabled: editId !== null } });
  if (editId && !details.data) {
    return <Screen testID="group-form.loading"><AppText>{t('common.loading')}</AppText></Screen>;
  }
  return <Form navigation={navigation} editId={editId} initial={details.data} />;
}

function Form({ navigation, editId, initial }: {
  navigation: Props['navigation'];
  editId: string | null;
  initial?: { name: string; description: string; visibility: 'public' | 'private'; color: string };
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const queryClient = useQueryClient();
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [visibility, setVisibility] = useState<'public' | 'private'>(initial?.visibility ?? 'public');
  const create = useGroupsCreate();
  const update = useGroupsUpdate();
  const busy = create.isPending || update.isPending;
  const valid = name.trim().length >= 3 && description.length <= 300;

  const save = async () => {
    try {
      const group = editId
        ? await update.mutateAsync({ id: editId, data: { name: name.trim(), description: description.trim(), visibility } })
        : await create.mutateAsync({ data: { name: name.trim(), description: description.trim(), visibility, color: '#0C807A' } });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGroupsListQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGroupsGetQueryKey(group.id) }),
      ]);
      toast.show({ variant: 'success', message: t(editId ? 'groups.updated' : 'groups.created') });
      navigation.replace('GroupDetails', { id: group.id });
    } catch {
      toast.show({ variant: 'error', message: t('groups.failed') });
    }
  };

  return (
    <Screen testID={editId ? 'group-form.edit' : 'group-form.create'} keyboardAware>
      <Pressable testID="group-form.back" accessibilityLabel="Back" onPress={navigation.goBack}>
        <Icon name="back" color={colors.ink} />
      </Pressable>
      <AppText variant="h1">{t(editId ? 'groups.edit' : 'groups.create')}</AppText>
      <TextField testID="group-form.name" label={t('groups.name')} value={name} onChangeText={setName} maxLength={80} autoCapitalize="sentences" />
      <TextField testID="group-form.description" label={t('groups.description')} value={description} onChangeText={setDescription} maxLength={300} autoCapitalize="sentences" />
      <View style={layout.field}>
        <AppText variant="chip">{t('groups.visibility')}</AppText>
        <View style={layout.options}>
          {(['public', 'private'] as const).map(option => (
            <Pressable
              key={option}
              testID={`group-form.${option}`}
              accessibilityLabel={t(`groups.${option}`)}
              accessibilityRole="radio"
              accessibilityState={{ checked: visibility === option }}
              onPress={() => setVisibility(option)}
              style={[layout.option, styles.option, visibility === option ? styles.selected : null]}
            >
              <AppText variant="button" tone={visibility === option ? 'teal700' : 'muted'}>{t(`groups.${option}`)}</AppText>
            </Pressable>
          ))}
        </View>
      </View>
      <AppButton testID="group-form.save" label={t('groups.save')} onPress={() => void save()} disabled={!valid} loading={busy} />
    </Screen>
  );
}

const layout = StyleSheet.create({
  field: { gap: spacing[8] },
  options: { flexDirection: 'row', gap: spacing[10] },
  option: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderWidth: borders.card, borderRadius: radii.input },
});
const useStyles = createThemedStyles(c => ({ option: { borderColor: c.line, backgroundColor: c.card }, selected: { borderColor: c.teal, backgroundColor: c.soft } }));

