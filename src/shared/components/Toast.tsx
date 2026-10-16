import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { conditionColors, type ThemeColors } from '../constants/colors';
import { borders, motion, radii, screenPadding, spacing } from '../constants/spacing';
import { createThemedStyles } from '../contexts/theme';
import { AppText } from './AppText';
import { Pressable } from './Pressable';
import { toast, type ToastInput, type ToastVariant } from './toastBus';

/** Visible time per variant (engineering-standards §10). */
const durations: Record<ToastVariant, number> = {
  success: 2500,
  info: 3000,
  error: 4000,
};

type QueuedToast = ToastInput & { id: number };

type ToastApi = { show: (input: ToastInput) => void };

const ToastContext = createContext<ToastApi | null>(null);

const entering = FadeInUp.duration(motion.enter).easing(Easing.out(Easing.cubic));
const exiting = FadeOutUp.duration(motion.exit).easing(Easing.in(Easing.cubic));

/**
 * In-house toasts: queued, one visible at a time, top of the screen below the safe-area inset,
 * tap to dismiss, announced to screen readers.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<QueuedToast[]>([]);
  const nextId = useRef(0);

  const show = useCallback((input: ToastInput) => {
    nextId.current += 1;
    const id = nextId.current;
    setQueue(current => [...current, { ...input, id }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setQueue(current => current.filter(item => item.id !== id));
  }, []);

  useEffect(() => toast.subscribe(show), [show]);

  const visible = queue[0];

  useEffect(() => {
    if (!visible) {
      return;
    }
    AccessibilityInfo.announceForAccessibility(visible.message);
    const timer = setTimeout(() => dismiss(visible.id), durations[visible.variant]);
    return () => clearTimeout(timer);
  }, [visible, dismiss]);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {visible ? <ToastView key={visible.id} item={visible} onDismiss={dismiss} /> : null}
    </ToastContext.Provider>
  );
}

function ToastView({ item, onDismiss }: { item: QueuedToast; onDismiss: (id: number) => void }) {
  const insets = useSafeAreaInsets();
  const styles = useStyles();

  return (
    <View pointerEvents="box-none" style={[layout.host, { paddingTop: insets.top + spacing[8] }]}>
      <Animated.View entering={entering} exiting={exiting}>
        <Pressable
          testID="app.toast"
          accessibilityLabel={item.message}
          accessibilityRole="alert"
          onPress={() => onDismiss(item.id)}
          style={[layout.toast, styles[item.variant]]}
        >
          <AppText variant="small" style={[layout.message, styles[`${item.variant}Text`]]}>
            {item.message}
          </AppText>
          {item.action ? (
            <Pressable
              testID="app.toast-action"
              accessibilityLabel={item.action.label}
              hitSlop={spacing[12]}
              onPress={() => {
                item.action?.onPress();
                onDismiss(item.id);
              }}
            >
              <AppText variant="small" style={styles[`${item.variant}Text`]}>
                {item.action.label}
              </AppText>
            </Pressable>
          ) : null}
        </Pressable>
      </Animated.View>
    </View>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) {
    throw new Error('useToast must be used inside ToastProvider');
  }
  return api;
}

const layout = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFill,
    paddingHorizontal: screenPadding,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
    borderRadius: radii.tile,
    borderWidth: borders.card,
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[16],
  },
  message: {
    flex: 1,
  },
});

const useStyles = createThemedStyles((c: ThemeColors) => ({
  success: {
    backgroundColor: conditionColors.go.chipBg,
    borderColor: conditionColors.go.ring,
  },
  successText: { color: conditionColors.go.chipFg },
  error: {
    backgroundColor: conditionColors.notNow.chipBg,
    borderColor: conditionColors.notNow.ring,
  },
  errorText: { color: conditionColors.notNow.chipFg },
  info: { backgroundColor: c.card, borderColor: c.line },
  infoText: { color: c.ink },
}));
