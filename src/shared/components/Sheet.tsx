import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { createContext, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radii, screenPadding, spacing } from '../constants/spacing';
import { createThemedStyles } from '../contexts/theme';
import { haptics } from '../utils/haptics';

type Props = {
  testID: string;
  accessibilityLabel: string;
  children: ReactNode;
  /** Set true to animate the sheet closed; `onDismiss` still fires when it is gone. */
  closing?: boolean;
  /** Fires once when the sheet has closed — swipe, backdrop tap or `dismiss`. */
  onDismiss: () => void;
};

const BACKDROP_OPACITY = 0.55;

/**
 * True inside a `Sheet`: `TextField` then renders gorhom's `BottomSheetTextInput`, which registers its focus
 * target so the sheet lifts above the keyboard (a plain `TextInput` is ignored and stays covered).
 */
export const InSheetContext = createContext(false);

/**
 * Bottom sheet (`@gorhom/bottom-sheet`): mount it to open, unmount it after `onDismiss`.
 * Content sizes itself; the bottom inset is applied by the sheet, not the screen.
 */
export function Sheet({ testID, accessibilityLabel, children, closing = false, onDismiss }: Props) {
  const ref = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const styles = useStyles();

  useEffect(() => {
    haptics.tap();
    ref.current?.present();
  }, []);

  useEffect(() => {
    if (closing) {
      ref.current?.dismiss();
    }
  }, [closing]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={BACKDROP_OPACITY}
        pressBehavior="close"
      />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={ref}
      enablePanDownToClose
      onDismiss={onDismiss}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handle}
      accessibilityLabel={accessibilityLabel}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      // Edge-to-edge (KeyboardProvider): the window never resizes, so the sheet lifts itself by the keyboard height.
      android_keyboardInputMode="adjustPan"
    >
      <BottomSheetView>
        <View
          testID={testID}
          accessibilityViewIsModal
          style={[layout.content, { paddingBottom: insets.bottom || spacing[20] }]}
        >
          <InSheetContext.Provider value>{children}</InSheetContext.Provider>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
}

const layout = StyleSheet.create({
  content: {
    paddingHorizontal: screenPadding,
    paddingTop: spacing[4],
    gap: spacing[16],
  },
});

const useStyles = createThemedStyles(c => ({
  background: { backgroundColor: c.card, borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet },
  handle: { backgroundColor: c.line, width: spacing[44] },
}));
