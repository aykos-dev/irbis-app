import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';

import { getGetEmergencyContactQueryKey, usePutEmergencyContact } from '../../../shared/api/generated/me/me';
import { errorMessageKey, isApiError } from '../../../shared/api/errors';
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

const VALIDATION_FAILED = 'VALIDATION_FAILED';

type Props = {
  /** Name and relation of the saved contact (the phone is never sent back unmasked). */
  initial: { name: string; relation: string } | null;
  onDismiss: () => void;
};

/** Add / change the emergency contact (AC4): name, relation, +998 phone → PUT. */
export function ContactSheet({ initial, onDismiss }: Props) {
  const [closing, setClosing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { isOnline } = useNetworkStatus();
  const queryClient = useQueryClient();
  const styles = useStyles();
  const { mutateAsync, isPending } = usePutEmergencyContact({ mutation: { meta: { silentError: true } } });

  const { control, handleSubmit, formState, watch } = useForm<ContactForm>({
    resolver: zodResolver(ContactFormSchema),
    defaultValues: { name: initial?.name ?? '', relation: initial?.relation ?? '', phone: '' },
    mode: 'onTouched',
    reValidateMode: 'onChange',
  });
  const name = watch('name');
  const relation = watch('relation');
  const phone = watch('phone');
  const filled = name.trim() !== '' && relation.trim() !== '' && phone !== '';

  const onSubmit = handleSubmit(
    async values => {
      setFormError(null);
      if (!isOnline) {
        haptics.error();
        setFormError(t('trip.offline'));
        return;
      }
      try {
        const saved = await mutateAsync({ data: values });
        queryClient.setQueryData(getGetEmergencyContactQueryKey(), saved);
        haptics.success();
        setClosing(true);
      } catch (error) {
        haptics.error();
        setFormError(
          isApiError(error) && error.code === VALIDATION_FAILED
            ? t('trip.contactPhoneInvalid')
            : t(errorMessageKey(error)),
        );
      }
    },
    () => haptics.error(),
  );
  const submit = () => {
    void onSubmit();
  };
  const fieldError = (message: string | undefined) => (message ? t(message) : undefined);

  return (
    <Sheet testID="trip.contact.sheet" accessibilityLabel={t('trip.contact')} closing={closing} onDismiss={onDismiss}>
      <View style={layout.form}>
        <AppText variant="h2" accessibilityRole="header">
          {t('trip.contact')}
        </AppText>
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <TextField
              testID="trip.contact.name"
              label={t('trip.contactName')}
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
              testID="trip.contact.relation"
              label={t('trip.contactRelation')}
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
              testID="trip.contact.phone"
              label={t('trip.contactPhone')}
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
          <AppText variant="small" testID="trip.contact.error" accessibilityRole="alert" style={styles.error}>
            {formError}
          </AppText>
        ) : null}
        <AppButton
          testID="trip.contact.save"
          label={t('trip.contactSave')}
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
