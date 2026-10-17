import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';

import type { RootStackScreenProps } from '../../../app/navigation/types';
import { useMeSetRecoveryPhone, useMeVerifyRecoveryPhone, getMeGetQueryKey } from '../../../shared/api/generated/me/me';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { Screen } from '../../../shared/components/Screen';
import { TextField } from '../../../shared/components/TextField';
import { toast } from '../../../shared/components/toastBus';
import { spacing } from '../../../shared/constants/spacing';
import { useAuth } from '../../../shared/contexts/auth';
import { createThemedStyles } from '../../../shared/contexts/theme';
import { zodResolver } from '../../../shared/forms/zodResolver';
import { useCountdown } from '../../../shared/hooks/useCountdown';
import { useNetworkStatus } from '../../../shared/hooks/useNetworkStatus';
import { t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { qaLog } from '../../../shared/utils/qaLog';
import { BackButton } from '../components/BackButton';
import { CodeInput } from '../components/CodeInput';
import { TextLink } from '../components/TextLink';
import {
  PHONE_PREFIX,
  PhoneFormSchema,
  VerifyFormSchema,
  toApiPhone,
  type PhoneForm,
  type VerifyForm,
} from '../schemas';
import { mapAuthError } from '../utils/authErrors';
import { formatPhoneInput } from '../utils/phone';

const SECONDS_PER_MINUTE = 60;

function clock(totalSeconds: number): string {
  return `${Math.floor(totalSeconds / SECONDS_PER_MINUTE)}:${String(totalSeconds % SECONDS_PER_MINUTE).padStart(2, '0')}`;
}

/** Add the recovery phone → enter the SMS code → verified (AC6). */
export function RecoveryPhoneScreen({ navigation }: RootStackScreenProps<'RecoveryPhone'>) {
  const { user } = useAuth();
  const [step, setStep] = useState<'phone' | 'code'>(user?.recoveryPhonePending ? 'code' : 'phone');
  const [phone, setPhone] = useState<string | null>(null);
  const { secondsLeft, start } = useCountdown();
  return (
    <Screen testID="auth.recovery-phone" keyboardAware>
      <View>
        <BackButton
          onPress={() => (step === 'code' && phone ? setStep('phone') : navigation.goBack())}
        />
      </View>
      {step === 'phone' ? (
        <PhoneStep
          onSent={(sentPhone, resendAfterSec) => {
            setPhone(sentPhone);
            start(resendAfterSec);
            setStep('code');
          }}
        />
      ) : (
        <CodeStep
          phone={phone}
          secondsLeft={secondsLeft}
          onResent={resendAfterSec => start(resendAfterSec)}
          onChangeNumber={() => setStep('phone')}
          onDone={() => navigation.goBack()}
        />
      )}
    </Screen>
  );
}

function PhoneStep({ onSent }: { onSent: (phone: string, resendAfterSec: number) => void }) {
  const { isOnline } = useNetworkStatus();
  const queryClient = useQueryClient();
  const { mutateAsync, isPending } = useMeSetRecoveryPhone({ mutation: { meta: { silentError: true } } });
  const [formError, setFormError] = useState<string | null>(null);
  const styles = useStyles();

  const { control, handleSubmit, formState, setError } = useForm<PhoneForm>({
    resolver: zodResolver(PhoneFormSchema),
    defaultValues: { phone: '' },
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
      const apiPhone = toApiPhone(values.phone);
      try {
        const sent = await mutateAsync({ data: { phone: apiPhone } });
        await queryClient.invalidateQueries({ queryKey: getMeGetQueryKey() });
        onSent(apiPhone, sent.resendAfterSec);
      } catch (error) {
        haptics.error();
        const mapped = mapAuthError(error);
        if (mapped.field === 'phone') {
          setError('phone', { type: 'server', message: 'auth.errors.phoneInvalid' }, { shouldFocus: true });
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

  return (
    <>
      <View style={styles.heading}>
        <AppText variant="h1" accessibilityRole="header">
          {t('auth.phone.title')}
        </AppText>
        <AppText variant="body" tone="muted">
          {t('auth.phone.body')}
        </AppText>
      </View>
      <Controller
        control={control}
        name="phone"
        render={({ field }) => (
          <TextField
            testID="auth.phone"
            label={t('auth.fields.phone')}
            prefix={PHONE_PREFIX}
            value={field.value}
            onChangeText={text => field.onChange(formatPhoneInput(text))}
            onBlur={field.onBlur}
            error={formState.errors.phone?.message ? t(formState.errors.phone.message) : undefined}
            placeholder={t('auth.fields.phonePlaceholder')}
            keyboardType="phone-pad"
            autoComplete="tel-national"
            textContentType="telephoneNumber"
            returnKeyType="done"
            onSubmitEditing={submit}
            autoFocus
          />
        )}
      />
      {formError ? (
        <AppText variant="small" testID="auth.error" accessibilityRole="alert" style={styles.error}>
          {formError}
        </AppText>
      ) : null}
      <View style={layout.grow} />
      <AppButton testID="auth.submit" label={t('auth.phone.submit')} loading={isPending} onPress={submit} />
    </>
  );
}

type CodeStepProps = {
  phone: string | null;
  secondsLeft: number;
  onResent: (resendAfterSec: number) => void;
  onChangeNumber: () => void;
  onDone: () => void;
};

function CodeStep({ phone, secondsLeft, onResent, onChangeNumber, onDone }: CodeStepProps) {
  const styles = useStyles();
  const { isOnline } = useNetworkStatus();
  const { setUser } = useAuth();
  const { mutateAsync: verifyAsync, isPending } = useMeVerifyRecoveryPhone({
    mutation: { meta: { silentError: true } },
  });
  const { mutateAsync: resendAsync } = useMeSetRecoveryPhone({ mutation: { meta: { silentError: true } } });
  const [formError, setFormError] = useState<string | null>(null);

  const { control, handleSubmit, formState, setError } = useForm<VerifyForm>({
    resolver: zodResolver(VerifyFormSchema),
    defaultValues: { code: '' },
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
        const me = await verifyAsync({ data: { code: values.code } });
        setUser(me);
        qaLog('recovery_phone_verified');
        haptics.success();
        toast.show({ variant: 'success', message: t('auth.phone.verifiedToast') });
        onDone();
      } catch (error) {
        haptics.error();
        const mapped = mapAuthError(error);
        if (mapped.field === 'code') {
          setError('code', { type: 'server', message: codeKey(mapped.code) }, { shouldFocus: true });
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
    if (!phone) {
      return;
    }
    setFormError(null);
    try {
      const sent = await resendAsync({ data: { phone } });
      onResent(sent.resendAfterSec);
      toast.show({ variant: 'info', message: t('auth.reset.resent') });
    } catch (error) {
      haptics.error();
      setFormError(mapAuthError(error).message);
    }
  };

  return (
    <>
      <View style={styles.heading}>
        <AppText variant="h1" accessibilityRole="header">
          {t('auth.phone.codeTitle')}
        </AppText>
        <AppText variant="body" tone="muted">
          {t('auth.phone.codeBody')}
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
            onSubmitEditing={submit}
            error={formState.errors.code?.message ? t(formState.errors.code.message) : undefined}
            autoFocus
          />
        )}
      />
      <View style={styles.links}>
        {phone ? (
          secondsLeft > 0 ? (
            <AppText variant="small" testID="auth.resend-countdown">
              {t('auth.reset.resendIn', { time: clock(secondsLeft) })}
            </AppText>
          ) : (
            <TextLink testID="auth.resend" label={t('auth.reset.resend')} onPress={onResend} />
          )
        ) : null}
        <TextLink testID="auth.change-number" label={t('auth.phone.changeNumber')} onPress={onChangeNumber} />
      </View>
      {formError ? (
        <AppText variant="small" testID="auth.error" accessibilityRole="alert" style={styles.error}>
          {formError}
        </AppText>
      ) : null}
      <View style={layout.grow} />
      <AppButton testID="auth.submit" label={t('auth.phone.verify')} loading={isPending} onPress={submit} />
    </>
  );
}

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
});

const useStyles = createThemedStyles(c => ({
  heading: { gap: spacing[8] },
  links: { gap: spacing[4] },
  error: { color: c.red700 },
}));
