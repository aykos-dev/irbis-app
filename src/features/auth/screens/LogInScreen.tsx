import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';

import type { AuthStackScreenProps } from '../../../app/navigation/types';
import { useAuthLogIn } from '../../../shared/api/generated/auth/auth';
import { apiErrorCodes, isApiError } from '../../../shared/api/errors';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { Mascot } from '../../../shared/components/Mascot';
import { Screen } from '../../../shared/components/Screen';
import { TextField, type TextInputHandle } from '../../../shared/components/TextField';
import { borders, radii, spacing } from '../../../shared/constants/spacing';
import { useAuth } from '../../../shared/contexts/auth';
import { createThemedStyles } from '../../../shared/contexts/theme';
import { zodResolver } from '../../../shared/forms/zodResolver';
import { useNetworkStatus } from '../../../shared/hooks/useNetworkStatus';
import { t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { qaLog } from '../../../shared/utils/qaLog';
import { BackButton } from '../components/BackButton';
import { BlockedCard } from '../components/BlockedCard';
import { TextLink } from '../components/TextLink';
import { useCloseAuth } from '../hooks/useCloseAuth';
import { useFinishAuth } from '../hooks/useFinishAuth';
import { LogInFormSchema, type LogInForm } from '../schemas';
import { mapAuthError } from '../utils/authErrors';

const MASCOT_SIZE = 96;

/** A1 — Log in (AC4, AC11). */
export function LogInScreen({ navigation }: AuthStackScreenProps<'LogIn'>) {
  const styles = useStyles();
  const close = useCloseAuth();
  const finish = useFinishAuth();
  const { isOnline } = useNetworkStatus();
  const { blockedNotice, showBlocked, clearBlocked } = useAuth();
  const { mutateAsync, isPending } = useAuthLogIn({ mutation: { meta: { silentError: true } } });
  const [formError, setFormError] = useState<string | null>(null);
  const passwordRef = useRef<TextInputHandle>(null);

  const { control, handleSubmit, formState } = useForm<LogInForm>({
    resolver: zodResolver(LogInFormSchema),
    defaultValues: { username: '', password: '' },
    mode: 'onTouched',
    reValidateMode: 'onChange',
  });

  useEffect(() => {
    if (blockedNotice) {
      qaLog('account_blocked_shown');
    }
  }, [blockedNotice]);

  const onSubmit = handleSubmit(async values => {
    setFormError(null);
    clearBlocked();
    if (!isOnline) {
      haptics.error();
      setFormError(t('auth.errors.offline'));
      return;
    }
    try {
      const session = await mutateAsync({
        data: { username: values.username.trim(), password: values.password },
      });
      qaLog('logged_in');
      await finish(session, 'auth.login.welcomeToast');
    } catch (error) {
      haptics.error();
      const mapped = mapAuthError(error);
      qaLog('log_in_failed', { code: mapped.code });
      if (isApiError(error) && error.code === apiErrorCodes.accountBlocked) {
        showBlocked(error.reasonCode);
        return;
      }
      setFormError(mapped.message);
    }
  });
  const submit = () => {
    void onSubmit();
  };

  return (
    <Screen testID="auth.login" keyboardAware>
      <View style={styles.top}>
        <BackButton onPress={close} />
        <TextLink testID="auth.continue-guest" label={t('auth.login.continueGuest')} onPress={close} />
      </View>
      <View style={styles.welcome}>
        <Mascot kind="default" size={MASCOT_SIZE} accessibilityLabel={t('auth.mascot.default')} />
        <View style={styles.bubble}>
          <AppText variant="h3" tone="ink">
            {t('auth.login.welcome')}
          </AppText>
        </View>
      </View>
      <AppText variant="h1" accessibilityRole="header">
        {t('auth.login.title')}
      </AppText>
      {blockedNotice ? <BlockedCard reasonCode={blockedNotice.reasonCode} /> : null}
      <View style={styles.form}>
        <Controller
          control={control}
          name="username"
          render={({ field }) => (
            <TextField
              testID="auth.username"
              label={t('auth.fields.username')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={formState.errors.username?.message ? t(formState.errors.username.message) : undefined}
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
              password
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="done"
              onSubmitEditing={submit}
            />
          )}
        />
        <TextLink
          testID="auth.forgot-link"
          label={t('auth.login.forgot')}
          align="end"
          onPress={() => navigation.navigate('ForgotPassword')}
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
      <View style={styles.actions}>
        <AppButton
          testID="auth.submit"
          label={t('auth.login.submit')}
          loading={isPending}
          onPress={submit}
        />
        <AppButton
          testID="auth.signup-link"
          label={t('auth.login.create')}
          variant="white"
          onPress={() => navigation.replace('SignUp')}
        />
        <AppText variant="small" style={layout.centered}>
          {t('auth.login.guestNote')}
        </AppText>
      </View>
    </Screen>
  );
}

const layout = StyleSheet.create({
  grow: { flexGrow: 1 },
  centered: { textAlign: 'center' },
});

const useStyles = createThemedStyles(c => ({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  welcome: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[10] },
  bubble: {
    flex: 1,
    marginBottom: spacing[22],
    borderRadius: radii.card,
    borderWidth: borders.card,
    borderColor: c.line,
    backgroundColor: c.card,
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[16],
  },
  form: { gap: spacing[18] },
  actions: { gap: spacing[14] },
  error: { color: c.red700 },
}));
