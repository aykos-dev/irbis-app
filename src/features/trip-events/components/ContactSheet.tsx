import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';

import { errorMessageKey } from '../../../shared/api/errors';
import { getGetEmergencyContactQueryKey, usePutEmergencyContact } from '../../../shared/api/generated/me/me';
import {
  putEmergencyContactBodyNameMax,
  putEmergencyContactBodyRelationMax,
} from '../../../shared/api/generated/zod/me/me.zod';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { Sheet } from '../../../shared/components/Sheet';
import { TextField } from '../../../shared/components/TextField';
import { spacing } from '../../../shared/constants/spacing';
import { createThemedStyles } from '../../../shared/contexts/theme';
import { zodResolver } from '../../../shared/forms/zodResolver';
import { useNetworkStatus } from '../../../shared/hooks/useNetworkStatus';
import { t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { ContactFormSchema, PHONE_PREFIX, formatPhoneInput, type ContactForm } from '../schemas';

type Props = {
  /** `create-trip` or `group-trip`: prefixes the testIDs. */
  scope: string;
  onSaved: () => void;
  onDismiss: () => void;
};

/** Emergency contact first (AC1, AC3): a group trip needs one saved before you publish or ask to join. */
export function ContactSheet({ scope, onSaved, onDismiss }: Props) {
  const [closing, setClosing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { isOnline } = useNetworkStatus();
  const queryClient = useQueryClient();
  const styles = useStyles();
  const { mutateAsync, isPending } = usePutEmergencyContact({ mutation: { meta: { silentError: true } } });

  const { control, handleSubmit, formState, watch } = useForm<ContactForm>({
    resolver: zodResolver(ContactFormSchema),
    defaultValues: { name: '', relation: '', phone: '' },
    mode: 'onTouched',
    reValidateMode: 'onChange',
  });
  const filled = watch('name').trim() !== '' && watch('relation').trim() !== '' && watch('phone') !== '';

  const onSubmit = handleSubmit(
    async values => {
      setFormError(null);
      if (!isOnline) {
        haptics.error();
        setFormError(t('tripEvents.offline'));
        return;
      }
      try {
        const saved = await mutateAsync({ data: values });
        queryClient.setQueryData(getGetEmergencyContactQueryKey(), saved);
        haptics.success();
        onSaved();
        setClosing(true);
      } catch (error) {
        haptics.error();
        setFormError(t(errorMessageKey(error)));
      }
    },
    () => haptics.error(),
  );
  const submit = () => {
    void onSubmit();
  };
  const fieldError = (message: string | undefined) => (message ? t(message) : undefined);

  return (
    <Sheet testID={`${scope}.contact-sheet`} accessibilityLabel={t('tripEvents.contact.title')} closing={closing} onDismiss={onDismiss}>
      <View style={layout.form}>
        <AppText variant="h2" accessibilityRole="header">
          {t('tripEvents.contact.title')}
        </AppText>
        <AppText variant="body" tone="muted">
          {t('tripEvents.contact.why')}
        </AppText>
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <TextField
              testID={`${scope}.contact-name`}
              label={t('tripEvents.contact.name')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldError(formState.errors.name?.message)}
              autoCapitalize="words"
              maxLength={putEmergencyContactBodyNameMax}
              returnKeyType="next"
            />
          )}
        />
        <Controller
          control={control}
          name="relation"
          render={({ field }) => (
            <TextField
              testID={`${scope}.contact-relation`}
              label={t('tripEvents.contact.relation')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldError(formState.errors.relation?.message)}
              maxLength={putEmergencyContactBodyRelationMax}
              returnKeyType="next"
            />
          )}
        />
        <Controller
          control={control}
          name="phone"
          render={({ field }) => (
            <TextField
              testID={`${scope}.contact-phone`}
              label={t('tripEvents.contact.phone')}
              prefix={PHONE_PREFIX}
              value={field.value}
              onChangeText={text => field.onChange(formatPhoneInput(text))}
              onBlur={field.onBlur}
              error={fieldError(formState.errors.phone?.message)}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              returnKeyType="done"
              onSubmitEditing={submit}
            />
          )}
        />
        {formError ? (
          <AppText variant="small" testID={`${scope}.contact-error`} accessibilityRole="alert" style={styles.error}>
            {formError}
          </AppText>
        ) : null}
        <AppButton
          testID={`${scope}.contact-save`}
          label={t('tripEvents.contact.save')}
          loading={isPending}
          disabled={!filled}
          onPress={submit}
        />
      </View>
    </Sheet>
  );
}

const layout = StyleSheet.create({
  form: { gap: spacing[16] },
});

const useStyles = createThemedStyles(c => ({
  error: { color: c.red700 },
}));
