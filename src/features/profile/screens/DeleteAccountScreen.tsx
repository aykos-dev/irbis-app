import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { RootStackParamList } from '../../../app/navigation/types';
import { useMeDelete } from '../../../shared/api/generated/me/me';
import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { Icon } from '../../../shared/components/Icon';
import { Pressable } from '../../../shared/components/Pressable';
import { Screen } from '../../../shared/components/Screen';
import { TextField } from '../../../shared/components/TextField';
import { spacing } from '../../../shared/constants/spacing';
import { useAuth } from '../../../shared/contexts/auth';
import { useTheme } from '../../../shared/contexts/theme';
import { haptics } from '../../../shared/utils/haptics';
type Nav = NativeStackNavigationProp<RootStackParamList>;
export function DeleteAccountScreen() {
  const navigation = useNavigation<Nav>();
  const { colors } = useTheme();
  const { signOut } = useAuth();
  const remove = useMeDelete();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const confirm = async () => {
    if (!password) {
      setError('Enter your current password.');
      return;
    }
    try {
      haptics.warning();
      await remove.mutateAsync({ data: { currentPassword: password } });
      await signOut();
    } catch {
      setError(
        'The password is incorrect or the account could not be deleted.',
      );
    }
  };
  return (
    <Screen testID="delete-account.screen" keyboardAware>
      <View style={styles.header}>
        <Pressable
          testID="delete-account.cancel"
          accessibilityLabel="Cancel"
          onPress={navigation.goBack}
        >
          <Icon name="back" color={colors.ink} />
        </Pressable>
        <AppText variant="h1">Delete account</AppText>
      </View>
      <AppText variant="body">
        This removes your profile and signs you out. This cannot be undone.
      </AppText>
      <TextField
        testID="delete-account.password"
        label="Current password"
        value={password}
        password
        onChangeText={setPassword}
        error={error ?? undefined}
      />
      <AppButton
        testID="delete-account.confirm"
        label="Delete account"
        variant="white"
        loading={remove.isPending}
        onPress={() => void confirm()}
      />
    </Screen>
  );
}
const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[14] },
});
