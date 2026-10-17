import { useNavigation } from '@react-navigation/native';
import { useCallback } from 'react';

/** Closes the whole auth modal (not just one screen of its stack), back to where it started. */
export function useCloseAuth(): () => void {
  const navigation = useNavigation();
  return useCallback(() => {
    const root = navigation.getParent();
    if (root) {
      root.goBack();
    } else {
      navigation.goBack();
    }
  }, [navigation]);
}
