import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';

import type { RootStackScreenProps } from '../../../app/navigation/types';
import { useMeSecure } from '../../../shared/api/generated/me/me';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { Checkbox } from '../../../shared/components/Checkbox';
import { Screen } from '../../../shared/components/Screen';
import { TextField, type TextInputHandle } from '../../../shared/components/TextField';
import { toast } from '../../../shared/components/toastBus';
import { spacing } from '../../../shared/constants/spacing';
import { useAuth } from '../../../shared/contexts/auth';
import { createThemedStyles } from '../../../shared/contexts/theme';
import { zodResolver } from '../../../shared/forms/zodResolver';
import { useNetworkStatus } from '../../../shared/hooks/useNetworkStatus';
import { t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { qaLog } from '../../../shared/utils/qaLog';
import { BackButton } from '../components/BackButton';
import { SecureFormSchema, type SecureForm } from '../schemas';
import { mapAuthError } from '../utils/authErrors';

/** Keeps typing within the schema's reach: a few extra characters show the length error. */
const USERNAME_INPUT_MAX = 32;

/** Secure your account (check-in AC8): a demo account sets its username + password. */
export function SecureAccountScreen({ navigation }: RootStackScreenProps<'SecureAccount'>) {
  const styles = useStyles();
  const { user, setUser, reloadUser } = useAuth();
  const { isOnline } = useNetworkStatus();
  const { mutateAsync, isPending } = useMeSecure({ mutation: { meta: { silentError: true } } });
  const [formError, setFormError] = useState<string | null>(null);
  const passwordRef = useRef<TextInputHandle>(null);
  const confirmRef = useRef<TextInputHandle>(null);

  const { control, handleSubmit, formState, setError } = useForm<SecureForm>({
    resolver: zodResolver(SecureFormSchema),
    defaultValues: { username: user?.username ?? '', password: '', confirm: '', acceptTerms: false },
    mode: 'onTouched',
    reValidateMode: 'onChange',
  });

  const onSubmit = handleSubmit(
    async values => {
      setFormError(null);
      if (!isOnline) {
        haptics.error();
        setFormError(t('auth.errors.offline'));
        return;
      }
      try {
        const me = await mutateAsync({
          data: { username: values.username.trim(), password: values.password, acceptTerms: values.acceptTerms },
        });
        setUser(me);
        reloadUser();
        qaLog('account_secured');
        haptics.success();
        toast.show({ variant: 'success', message: t('auth.secure.done') });
        navigation.goBack();
      } catch (error) {
        haptics.error();
        const mapped = mapAuthError(error);
        const field = mapped.field === 'terms' ? 'acceptTerms' : mapped.field;
        if (field === 'username' || field === 'password' || field === 'acceptTerms') {
          setError(field, { type: 'server', message: mapped.message }, { shouldFocus: true });
        } else {
          setFormError(mapped.message);
        }
      }
    },
    () => haptics.error(),
  );
  const submit = () => {
    void onSubmit();
  };

  /** Schema messages are i18n keys; server ones (type `server`) arrive translated by mapAuthError. */
  const message = (error: { type?: string; message?: string } | undefined) =>
    error?.message ? (error.type === 'server' ? error.message : t(error.message)) : undefined;

  return (
    <Screen testID="auth.secure" keyboardAware>
      <View>
        <BackButton onPress={() => navigation.goBack()} />
      </View>
      <View style={styles.heading}>
        <AppText variant="h1" accessibilityRole="header">
          {t('auth.secure.title')}
        </AppText>
        <AppText variant="body" tone="muted">
          {t('auth.secure.subtitle')}
        </AppText>
      </View>
      <View style={styles.form}>
        <Controller
          control={control}
          name="username"
          render={({ field }) => (
            <TextField
              testID="secure.username"
              label={t('auth.fields.username')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={message(formState.errors.username)}
              hint={t('auth.signup.usernameHint')}
              maxLength={USERNAME_INPUT_MAX}
              autoComplete="username"
              textContentType="username"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field }) => (
            <TextField
              testID="secure.password"
              label={t('auth.fields.password')}
              inputRef={passwordRef}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={message(formState.errors.password)}
              hint={t('auth.signup.passwordHint')}
              password
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus()}
            />
          )}
        />
        <Controller
          control={control}
          name="confirm"
          render={({ field }) => (
            <TextField
              testID="secure.confirm"
              label={t('auth.secure.confirm')}
              inputRef={confirmRef}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={message(formState.errors.confirm)}
              password
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="done"
              onSubmitEditing={submit}
            />
          )}
        />
        <Controller
          control={control}
          name="acceptTerms"
          render={({ field }) => (
            <Checkbox
              testID="secure.terms"
              label={t('auth.signup.terms')}
              checked={field.value}
              onChange={field.onChange}
              error={message(formState.errors.acceptTerms)}
            />
          )}
        />
        {formError ? (
          <AppText
            variant="small"
            testID="secure.error"
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={styles.error}
          >
            {formError}
          </AppText>
        ) : null}
      </View>
      <View style={layout.grow} />
      <AppButton testID="secure.submit" label={t('auth.secure.submit')} loading={isPending} onPress={submit} />
    </Screen>
  );
}

const layout = StyleSheet.create({
  grow: { flexGrow: 1 },
});

const useStyles = createThemedStyles(c => ({
  heading: { gap: spacing[6] },
  form: { gap: spacing[18] },
  error: { color: c.red700 },
}));
