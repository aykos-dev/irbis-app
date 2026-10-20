import { useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';

import { companionFoxCheeringSvg } from '../../../assets/svg/companionFoxCheering';
import { CompanionArt } from '../../../shared/components/levels/CompanionArt';
import { Mascot } from '../../../shared/components/Mascot';
import { motion } from '../../../shared/constants/spacing';

const BOUNCE = -12;
const FOX = 3;
const PANDA = 1;

type Props = { level: number; cheering: boolean; size: number; testID?: string };

/**
 * The user's companion on the quiz (AC5): neutral, or cheering after a right answer — the fox (L3)
 * and the panda (L1) have a cheering pose; the others bounce in their neutral pose (owner Q11).
 */
export function CompanionReaction({ level, cheering, size, testID }: Props) {
  const reduceMotion = useReducedMotion();
  const lift = useSharedValue(0);
  const posed = cheering && (level === FOX || level === PANDA);

  useEffect(() => {
    if (cheering && !posed && !reduceMotion) {
      lift.value = withSequence(withTiming(BOUNCE, { duration: motion.press }), withSpring(0));
    }
  }, [cheering, posed, reduceMotion, lift]);

  const bounce = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }] }));

  let art;
  if (cheering && level === FOX) {
    art = <SvgXml xml={companionFoxCheeringSvg} width={size} height={size} />;
  } else if (cheering && level === PANDA) {
    art = <Mascot kind="pandaCheering" size={size} />;
  } else {
    art = <CompanionArt level={level} size={size} />;
  }
  return (
    <Animated.View testID={testID} style={bounce} importantForAccessibility="no-hide-descendants">
      {art}
    </Animated.View>
  );
}
