import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';

import type { AuthStackScreenProps } from '../../../app/navigation/types';
import { useAuthForgotPassword } from '../../../shared/api/generated/auth/auth';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { Icon } from '../../../shared/components/Icon';
import { Mascot } from '../../../shared/components/Mascot';
import { Screen } from '../../../shared/components/Screen';
import { TextField } from '../../../shared/components/TextField';
import { borders, radii, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles, useTheme } from '../../../shared/contexts/theme';
import { zodResolver } from '../../../shared/forms/zodResolver';
import { useNetworkStatus } from '../../../shared/hooks/useNetworkStatus';
import { t } from '../../../shared/i18n';
import { haptics } from '../../../shared/utils/haptics';
import { qaLog } from '../../../shared/utils/qaLog';
import { BackButton } from '../components/BackButton';
import { ForgotFormSchema, type ForgotForm } from '../schemas';
import { mapAuthError } from '../utils/authErrors';

const MASCOT_SIZE = 130;
const INFO_ICON = 22;

/** A4 — Forgot your password? The next screen looks the same whether or not the account exists (AC5). */
export function ForgotPasswordScreen({ navigation }: AuthStackScreenProps<'ForgotPassword'>) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { isOnline } = useNetworkStatus();
  const { mutateAsync, isPending } = useAuthForgotPassword({ mutation: { meta: { silentError: true } } });
  const [formError, setFormError] = useState<string | null>(null);

  const { control, handleSubmit, formState } = useForm<ForgotForm>({
    resolver: zodResolver(ForgotFormSchema),
    defaultValues: { username: '' },
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
      const username = values.username.trim();
      try {
        const sent = await mutateAsync({ data: { username } });
        qaLog('password_reset_requested');
        navigation.navigate('ResetCode', { username, resendAfterSec: sent.resendAfterSec });
      } catch (error) {
        haptics.error();
        setFormError(mapAuthError(error).message);
      }
    },
    () => haptics.error(),
  );
  const submit = () => {
    void onSubmit();
  };

  return (
    <Screen testID="auth.forgot" keyboardAware>
      <View>
        <BackButton onPress={() => navigation.goBack()} />
      </View>
      <View style={styles.hero}>
        <Mascot kind="worried" size={MASCOT_SIZE} accessibilityLabel={t('auth.mascot.worried')} />
        <AppText variant="h1" accessibilityRole="header" style={layout.centered}>
          {t('auth.forgot.title')}
        </AppText>
        <AppText variant="body" tone="muted" style={layout.centered}>
          {t('auth.forgot.body')}
        </AppText>
      </View>
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
      <View testID="auth.support-note" accessible style={styles.card}>
        <Icon name="info" color={colors.muted} size={INFO_ICON} />
        <View style={styles.cardText}>
          <AppText variant="h3">{t('auth.forgot.noPhoneTitle')}</AppText>
          <AppText variant="small">{t('auth.forgot.noPhoneBody')}</AppText>
        </View>
      </View>
      <View style={layout.grow} />
      <AppButton
        testID="auth.submit"
        label={t('auth.forgot.submit')}
        loading={isPending}
        onPress={submit}
      />
    </Screen>
  );
}

const layout = StyleSheet.create({
  grow: { flexGrow: 1 },
  centered: { textAlign: 'center' },
});

const useStyles = createThemedStyles(c => ({
  hero: { alignItems: 'center', gap: spacing[10] },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[12],
    paddingVertical: spacing[14],
    paddingHorizontal: spacing[16],
    borderRadius: radii.card,
    borderWidth: borders.card,
    borderBottomWidth: borders.edge,
    borderColor: c.line,
    backgroundColor: c.card,
  },
  cardText: { flex: 1, gap: spacing[4] },
  error: { color: c.red700 },
}));
