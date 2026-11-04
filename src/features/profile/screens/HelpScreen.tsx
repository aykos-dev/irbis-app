import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';

import type { RootStackParamList } from '../../../app/navigation/types';
import { AppText } from '../../../shared/components/AppText';
import { Icon } from '../../../shared/components/Icon';
import { ListCard, ListRow } from '../../../shared/components/ListRow';
import { Pressable } from '../../../shared/components/Pressable';
import { Screen } from '../../../shared/components/Screen';
import { spacing } from '../../../shared/constants/spacing';
import { useTheme } from '../../../shared/contexts/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function HelpScreen() {
  const navigation = useNavigation<Nav>();
  const { colors } = useTheme();
  return (
    <Screen testID="help.screen" scroll>
      <View style={styles.header}>
        <Pressable
          testID="help.back"
          accessibilityLabel="Back"
          onPress={navigation.goBack}
        >
          <Icon name="back" color={colors.ink} />
        </Pressable>
        <AppText variant="h1">Help & feedback</AppText>
      </View>
      <AppText variant="body" tone="muted">
        Support and feedback channels are coming soon.
      </AppText>
      <ListCard>
        <ListRow
          first
          testID="help.delete-account"
          label="Delete account"
          icon={<Icon name="person" color={colors.red700} />}
          onPress={() => navigation.navigate('DeleteAccount')}
        />
      </ListCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[14] },
});
