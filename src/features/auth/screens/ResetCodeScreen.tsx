import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';

import type { AuthStackScreenProps } from '../../../app/navigation/types';
import {
  useAuthForgotPassword,
  useAuthResetPassword,
} from '../../../shared/api/generated/auth/auth';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { Screen } from '../../../shared/components/Screen';
import { TextField, type TextInputHandle } from '../../../shared/components/TextField';
import { toast } from '../../../shared/components/toastBus';
import { spacing } from '../../../shared/constants/spacing';
import { zodResolver } from '../../../shared/forms/zodResolver';
import { useCountdown } from '../../../shared/hooks/useCountdown';
import { useNetworkStatus } from '../../../shared/hooks/useNetworkStatus';
import { t } from '../../../shared/i18n';
import { createThemedStyles } from '../../../shared/contexts/theme';
import { haptics } from '../../../shared/utils/haptics';
import { qaLog } from '../../../shared/utils/qaLog';
import { BackButton } from '../components/BackButton';
import { CodeInput } from '../components/CodeInput';
import { TextLink } from '../components/TextLink';
import { useFinishAuth } from '../hooks/useFinishAuth';
import { ResetFormSchema, type ResetForm } from '../schemas';
import { mapAuthError } from '../utils/authErrors';

const SECONDS_PER_MINUTE = 60;

function clock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** A5 — Enter the code + a new password (AC5). */
export function ResetCodeScreen({ navigation, route }: AuthStackScreenProps<'ResetCode'>) {
  const { username, resendAfterSec } = route.params;
  const styles = useStyles();
  const finish = useFinishAuth();
  const { isOnline } = useNetworkStatus();
  const { mutateAsync: resetAsync, isPending } = useAuthResetPassword({
    mutation: { meta: { silentError: true } },
  });
  const { mutateAsync: resendAsync, isPending: isResending } = useAuthForgotPassword({
    mutation: { meta: { silentError: true } },
  });
  const [formError, setFormError] = useState<string | null>(null);
  const { secondsLeft, start } = useCountdown();
  const passwordRef = useRef<TextInputHandle>(null);

  useEffect(() => {
    start(resendAfterSec);
  }, [start, resendAfterSec]);

  const { control, handleSubmit, formState, setError } = useForm<ResetForm>({
    resolver: zodResolver(ResetFormSchema),
    defaultValues: { code: '', newPassword: '' },
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
        const session = await resetAsync({
          data: { username, code: values.code, newPassword: values.newPassword },
        });
        qaLog('password_reset_done');
        await finish(session, 'auth.reset.doneToast');
      } catch (error) {
        haptics.error();
        const mapped = mapAuthError(error);
        if (mapped.field === 'code') {
          setError('code', { type: 'server', message: codeKey(mapped.code) }, { shouldFocus: true });
        } else if (mapped.field === 'password') {
          setError('newPassword', { type: 'server', message: 'auth.errors.passwordWeak' }, { shouldFocus: true });
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

  const onResend = async () => {
    setFormError(null);
    if (!isOnline) {
      haptics.error();
      setFormError(t('auth.errors.offline'));
      return;
    }
    try {
      const sent = await resendAsync({ data: { username } });
      qaLog('password_reset_requested');
      start(sent.resendAfterSec);
      toast.show({ variant: 'info', message: t('auth.reset.resent') });
    } catch (error) {
      haptics.error();
      setFormError(mapAuthError(error).message);
    }
  };

  return (
    <Screen testID="auth.reset" keyboardAware>
      <View>
        <BackButton onPress={() => navigation.goBack()} />
      </View>
      <View style={styles.heading}>
        <AppText variant="h1" accessibilityRole="header">
          {t('auth.reset.title')}
        </AppText>
        <AppText variant="body" tone="muted">
          {t('auth.reset.body')}
        </AppText>
      </View>
      <Controller
        control={control}
        name="code"
        render={({ field }) => (
          <CodeInput
            label={t('auth.fields.code')}
            value={field.value}
            onChangeText={field.onChange}
            onSubmitEditing={() => passwordRef.current?.focus()}
            error={formState.errors.code?.message ? t(formState.errors.code.message) : undefined}
            autoFocus
          />
        )}
      />
      <View style={styles.resend} testID="auth.resend-row">
        {secondsLeft > 0 ? (
          <AppText variant="small" testID="auth.resend-countdown">
            {t('auth.reset.resendIn', { time: clock(secondsLeft) })}
          </AppText>
        ) : (
          <TextLink
            testID="auth.resend"
            label={t('auth.reset.resend')}
            onPress={isResending ? noop : onResend}
          />
        )}
      </View>
      <Controller
        control={control}
        name="newPassword"
        render={({ field }) => (
          <TextField
            testID="auth.new-password"
            label={t('auth.fields.newPassword')}
            inputRef={passwordRef}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={formState.errors.newPassword?.message ? t(formState.errors.newPassword.message) : undefined}
            placeholder={t('auth.reset.newPasswordPlaceholder')}
            password
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="done"
            onSubmitEditing={submit}
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
      <View style={layout.grow} />
      <View style={styles.actions}>
        <AppButton
          testID="auth.submit"
          label={t('auth.reset.submit')}
          loading={isPending}
          onPress={submit}
        />
        <AppText variant="small" style={layout.centered}>
          {t('auth.reset.note')}
        </AppText>
      </View>
    </Screen>
  );
}

function noop(): void {}

function codeKey(code: string): string {
  switch (code) {
    case 'CODE_EXPIRED':
      return 'auth.errors.codeExpired';
    case 'CODE_ATTEMPTS':
      return 'auth.errors.codeAttempts';
    default:
      return 'auth.errors.codeInvalid';
  }
}

const layout = StyleSheet.create({
  grow: { flexGrow: 1 },
  centered: { textAlign: 'center' },
});

const useStyles = createThemedStyles(c => ({
  heading: { gap: spacing[8] },
  resend: { minHeight: spacing[44], justifyContent: 'center' },
  actions: { gap: spacing[10] },
  error: { color: c.red700 },
}));
