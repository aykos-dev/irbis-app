import LottieView, { type LottieViewProps } from 'lottie-react-native';
import type { ReactElement } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

/** Every named mascot animation the app plays. */
export type MotionName = 'irbis-wave' | 'irbis-nod';

/**
 * The only place animation sources are registered. None exist yet (owner Q13: placeholders), so
 * every `Motion` renders its static fallback until a Lottie file is added here.
 */
const sources: Partial<Record<MotionName, LottieViewProps['source']>> = {};

type Props = {
  name: MotionName;
  /** The static art shown when no animation is registered for `name` (the Mascot). */
  fallback: ReactElement;
  /** Square size of the animation, matching the fallback. */
  size: number;
  loop?: boolean;
  testID?: string;
};

/** A named animation with a static fallback. Reduced motion: shown, never autoplayed. */
export function Motion({ name, fallback, size, loop = false, testID }: Props) {
  const reducedMotion = useReducedMotion();
  const source = sources[name];
  if (!source) {
    return fallback;
  }
  return (
    <LottieView
      testID={testID}
      source={source}
      autoPlay={!reducedMotion}
      loop={loop && !reducedMotion}
      style={{ width: size, height: size }}
    />
  );
}
