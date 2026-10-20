import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';

import { useAppState } from '../../../shared/hooks/useAppState';
import { heartsStore, tashkentDay } from '../heartsStore';

type Hearts = { hearts: number; day: string };

function read(): Hearts {
  return { hearts: heartsStore.hearts(), day: tashkentDay() };
}

/**
 * Today's hearts (AC6), re-read on focus, on return to the foreground and after every change, so
 * a screen left open over midnight shows the refill.
 */
export function useHearts(): Hearts {
  const [state, setState] = useState(read);
  const appState = useAppState();

  const refresh = useCallback(() => {
    const next = read();
    setState(prev => (prev.hearts === next.hearts && prev.day === next.day ? prev : next));
  }, []);

  useFocusEffect(refresh);
  useEffect(() => heartsStore.subscribe(refresh), [refresh]);
  useEffect(() => {
    if (appState === 'active') {
      refresh();
    }
  }, [appState, refresh]);

  return state;
}
