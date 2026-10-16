import HapticFeedback from 'react-native-haptic-feedback';

/**
 * The only caller of the haptics library (engineering-standards §2). Respects the OS setting.
 *
 * | Situation                                   | Call            |
 * | ------------------------------------------- | --------------- |
 * | Button / row press, sheet open, tab change  | `tap()`         |
 * | Toggle, checkbox, pill, segment, drag snap  | `selection()`   |
 * | Success (saved, checked in, reward earned)  | `success()`     |
 * | Validation failure, refused action          | `error()`       |
 * | Destructive action confirmed                | `warning()`     |
 * | Drag picks up                               | `pickUp()`      |
 */
const options = {
  enableVibrateFallback: false,
  ignoreAndroidSystemSettings: false,
} as const;

function trigger(type: Parameters<typeof HapticFeedback.trigger>[0]): void {
  HapticFeedback.trigger(type, options);
}

export const haptics = {
  tap: () => trigger('impactLight'),
  selection: () => trigger('selection'),
  success: () => trigger('notificationSuccess'),
  error: () => trigger('notificationError'),
  warning: () => trigger('notificationWarning'),
  pickUp: () => trigger('impactMedium'),
};
