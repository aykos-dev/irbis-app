import { StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn } from 'react-native-reanimated';

import { AppButton } from '../../../shared/components/AppButton';
import { AppText } from '../../../shared/components/AppText';
import { Pressable } from '../../../shared/components/Pressable';
import { StatusChip } from '../../../shared/components/StatusChip';
import { borders, motion, radii, spacing } from '../../../shared/constants/spacing';
import { createThemedStyles } from '../../../shared/contexts/theme';
import { t } from '../../../shared/i18n';
import { nodeSize, popoverSize } from '../pathLayout';
import type { NodeChip } from '../pathText';

type Props = {
  name: string;
  chip: NodeChip | null;
  /** Node centre and the trail box, in trail px. */
  x: number;
  y: number;
  width: number;
  height: number;
  onOpen: () => void;
  onClose: () => void;
};

const entering = FadeIn.duration(motion.enter).easing(Easing.out(Easing.cubic));

/**
 * The tapped node's popover (AC2): name, chip and "Open place". Opens below the node (above it in
 * the lower half of the trail); a tap anywhere else on the trail closes it.
 */
export function NodePopover({ name, chip, x, y, width, height, onOpen, onClose }: Props) {
  const styles = useStyles();
  const half = nodeSize.ring / 2;
  const left = Math.min(Math.max(x - popoverSize.width / 2, 0), Math.max(width - popoverSize.width, 0));
  const vertical = y > height / 2 ? { bottom: height - (y - half - popoverSize.gap) } : { top: y + half + popoverSize.gap };
  return (
    <>
      <Pressable
        testID="path.popover.backdrop"
        accessibilityLabel={t('common.close')}
        feedback="none"
        onPress={onClose}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View entering={entering} testID="path.popover" style={[styles.card, { left }, vertical]}>
        <AppText variant="h3">{name}</AppText>
        {chip ? <StatusChip testID="path.popover.status" variant={chip.variant} label={chip.label} /> : null}
        <View>
          <AppButton testID="path.popover.open-place" label={t('path.openPlace')} onPress={onOpen} />
        </View>
      </Animated.View>
    </>
  );
}

const useStyles = createThemedStyles(c => ({
  card: {
    position: 'absolute',
    width: popoverSize.width,
    gap: spacing[10],
    padding: spacing[14],
    borderRadius: radii.card,
    borderWidth: borders.card,
    borderBottomWidth: borders.edge,
    borderColor: c.line,
    backgroundColor: c.card,
  },
}));
