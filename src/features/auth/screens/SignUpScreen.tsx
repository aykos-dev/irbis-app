import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';

import type { AuthStackScreenProps } from '../../../app/navigation/types';
import { useAuthSignUp } from '../../../shared/api/generated/auth/auth';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { Checkbox } from '../../../shared/components/Checkbox';
import { Mascot } from '../../../shared/components/Mascot';
import { Screen } from '../../../shared/components/Screen';
import { TextField, type TextInputHandle } from '../../../shared/components/TextField';
import { borders, radii, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles } from '../../../shared/contexts/theme';
import { zodResolver } from '../../../shared/forms/zodResolver';
import { useNetworkStatus } from '../../../shared/hooks/useNetworkStatus';
import { getLocale, t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { qaLog } from '../../../shared/utils/qaLog';
import { BackButton } from '../components/BackButton';
import { TextLink } from '../components/TextLink';
import { useCloseAuth } from '../hooks/useCloseAuth';
import { useFinishAuth } from '../hooks/useFinishAuth';
import { useUsernameAvailability } from '../hooks/useUsernameAvailability';
import { PHONE_PREFIX, SignUpFormSchema, digitsOnly, toApiPhone, type SignUpForm } from '../schemas';
import { mapAuthError } from '../utils/authErrors';
import { formatPhoneInput } from '../utils/phone';

const MASCOT_SIZE = 52;

/** A2 — Create your account (AC3). */
export function SignUpScreen({ navigation }: AuthStackScreenProps<'SignUp'>) {
  const styles = useStyles();
  const close = useCloseAuth();
  const finish = useFinishAuth();
  const { isOnline } = useNetworkStatus();
  const { mutateAsync, isPending } = useAuthSignUp({ mutation: { meta: { silentError: true } } });
  const [formError, setFormError] = useState<string | null>(null);
  const passwordRef = useRef<TextInputHandle>(null);
  const phoneRef = useRef<TextInputHandle>(null);

  const { control, handleSubmit, formState, setError, watch } = useForm<SignUpForm>({
    resolver: zodResolver(SignUpFormSchema),
    defaultValues: { username: '', password: '', phone: '', acceptTerms: false },
    mode: 'onTouched',
    reValidateMode: 'onChange',
  });
  const availability = useUsernameAvailability(watch('username'));

  const onSubmit = handleSubmit(
    async values => {
      setFormError(null);
      if (!isOnline) {
        haptics.error();
        setFormError(t('auth.errors.offline'));
        return;
      }
      const hasPhone = digitsOnly(values.phone) !== '';
      try {
        const session = await mutateAsync({
          data: {
            username: values.username.trim(),
            password: values.password,
            recoveryPhone: hasPhone ? toApiPhone(values.phone) : undefined,
            locale: getLocale(),
            acceptTerms: values.acceptTerms,
          },
        });
        qaLog('signed_up', { has_phone: hasPhone });
        await finish(session, 'auth.signup.doneToast');
      } catch (error) {
        haptics.error();
        const mapped = mapAuthError(error);
        const field = mapped.field === 'terms' ? 'acceptTerms' : mapped.field;
        if (field === 'username' || field === 'password' || field === 'phone' || field === 'acceptTerms') {
          setError(field, { type: 'server', message: serverKey(mapped.code) }, { shouldFocus: true });
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

  const usernameError = formState.errors.username?.message;
  return (
    <Screen testID="auth.signup" keyboardAware>
      <View style={styles.top}>
        <BackButton onPress={close} />
        <TextLink testID="auth.login-link" label={t('auth.signup.login')} onPress={() => navigation.replace('LogIn')} />
      </View>
      <View style={styles.heading}>
        <AppText variant="h1" accessibilityRole="header">
          {t('auth.signup.title')}
        </AppText>
        <AppText variant="body" tone="muted">
          {t('auth.signup.subtitle')}
        </AppText>
      </View>
      <View style={styles.carry} accessible>
        <Mascot kind="excited" size={MASCOT_SIZE} />
        <AppText variant="small" style={styles.carryText}>
          {t('auth.signup.carry')}
        </AppText>
      </View>
      <View style={styles.form}>
        <Controller
          control={control}
          name="username"
          render={({ field }) => (
            <TextField
              testID="auth.username"
              statusTestID="auth.username-status"
              label={t('auth.fields.username')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={usernameError ? t(usernameError) : availability.error}
              status={availability.status === 'error' ? 'pristine' : availability.status}
              statusText={
                availability.status === 'validating'
                  ? t('auth.signup.usernameChecking')
                  : availability.status === 'success'
                    ? t('auth.signup.usernameFree', { username: field.value.trim() })
                    : undefined
              }
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
              testID="auth.password"
              label={t('auth.fields.password')}
              inputRef={passwordRef}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={formState.errors.password?.message ? t(formState.errors.password.message) : undefined}
              hint={t('auth.signup.passwordHint')}
              password
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="next"
              onSubmitEditing={() => phoneRef.current?.focus()}
            />
          )}
        />
        <Controller
          control={control}
          name="phone"
          render={({ field }) => (
            <TextField
              testID="auth.phone"
              label={t('auth.fields.phone')}
              optionalLabel={t('auth.fields.optional')}
              inputRef={phoneRef}
              prefix={PHONE_PREFIX}
              value={field.value}
              onChangeText={text => field.onChange(formatPhoneInput(text))}
              onBlur={field.onBlur}
              error={formState.errors.phone?.message ? t(formState.errors.phone.message) : undefined}
              placeholder={t('auth.fields.phonePlaceholder')}
              hint={t('auth.signup.phoneHint')}
              keyboardType="phone-pad"
              autoComplete="tel-national"
              textContentType="telephoneNumber"
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
              testID="auth.terms"
              label={t('auth.signup.terms')}
              checked={field.value}
              onChange={field.onChange}
              error={formState.errors.acceptTerms?.message ? t(formState.errors.acceptTerms.message) : undefined}
            />
          )}
        />
        {formError ? (
          <AppText
            variant="small"
            testID="auth.error"
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={styles.error}
          >
            {formError}
          </AppText>
        ) : null}
      </View>
      <View style={layout.grow} />
      <AppButton
        testID="auth.submit"
        label={t('auth.signup.submit')}
        loading={isPending}
        onPress={submit}
      />
    </Screen>
  );
}

/** Keeps typing within the schema's reach: a few extra characters show the length error. */
const USERNAME_INPUT_MAX = 32;

/** i18n key for a server error code that lands on a form field. */
function serverKey(code: string): string {
  switch (code) {
    case 'USERNAME_TAKEN':
      return 'auth.errors.usernameTaken';
    case 'USERNAME_RESERVED':
      return 'auth.errors.usernameReserved';
    case 'USERNAME_INVALID':
      return 'auth.errors.usernameInvalid';
    case 'PASSWORD_WEAK':
      return 'auth.errors.passwordWeak';
    case 'TERMS_REQUIRED':
      return 'auth.errors.termsRequired';
    case 'PHONE_INVALID':
      return 'auth.errors.phoneInvalid';
    default:
      return 'auth.errors.fieldInvalid';
  }
}

const layout = StyleSheet.create({
  grow: { flexGrow: 1 },
});

const useStyles = createThemedStyles(c => ({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { gap: spacing[6] },
  carry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[14],
    borderRadius: radii.tile,
    borderWidth: borders.card,
    borderColor: c.navActiveBorder,
    backgroundColor: c.navActiveBg,
  },
  carryText: { flex: 1, color: c.navActiveFg },
  form: { gap: spacing[18] },
  error: { color: c.red700 },
}));
