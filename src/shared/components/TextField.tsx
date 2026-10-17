import { useState, type ComponentRef, type Ref } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import Animated, { Easing, FadeIn, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { conditionColors } from '../constants/colors';
import { borders, motion, radii, sizes, spacing } from '../constants/spacing';
import { typography } from '../constants/typography';
import { createThemedStyles, useTheme } from '../contexts/theme';
import { t } from '../i18n';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { Pressable } from './Pressable';

/** What a ref to the field's input holds (`.focus()`, `.blur()`). */
export type TextInputHandle = ComponentRef<typeof TextInput>;

/** Engineering-standards §9: pristine · validating · success · error. */
export type FieldStatus = 'pristine' | 'validating' | 'success' | 'error';

type Props = Pick<
  TextInputProps,
  | 'value'
  | 'onChangeText'
  | 'onBlur'
  | 'onSubmitEditing'
  | 'autoComplete'
  | 'textContentType'
  | 'keyboardType'
  | 'returnKeyType'
  | 'maxLength'
  | 'placeholder'
  | 'autoFocus'
  | 'autoCapitalize'
> & {
  label: string;
  testID: string;
  inputRef?: Ref<TextInputHandle>;
  /** Server- or schema-side error; border and message always appear together. */
  error?: string;
  /** Async-check state (username availability). `error` wins over it. */
  status?: Exclude<FieldStatus, 'error'>;
  /** Text next to the success / validating indicator ("aziz_hikes is free"). */
  statusText?: string;
  hint?: string;
  /** Password fields get the show / hide toggle (`<testID>-toggle`). */
  password?: boolean;
  /** Fixed leading block, e.g. "+998". */
  prefix?: string;
  optionalLabel?: string;
  /** Resolves to `<testID>-status` for the status line. */
  statusTestID?: string;
};

const fade = FadeIn.duration(motion.enter).easing(Easing.out(Easing.cubic));

/** Labelled input with the four visible states, hint line, password toggle and prefix. */
export function TextField({
  label,
  testID,
  inputRef,
  error,
  status = 'pristine',
  statusText,
  hint,
  password = false,
  prefix,
  optionalLabel,
  statusTestID,
  ...input
}: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const state: FieldStatus = error ? 'error' : status;
  const borderTarget =
    state === 'error'
      ? colors.red700
      : state === 'success'
        ? conditionColors.go.ring
        : focused
          ? colors.teal
          : colors.line;

  const borderStyle = useAnimatedStyle(
    () => ({
      borderColor: withTiming(borderTarget, {
        duration: motion.press,
        easing: Easing.out(Easing.cubic),
      }),
    }),
    [borderTarget],
  );

  const showTrailingSpinner = state === 'validating';

  return (
    <View style={layout.field}>
      <View style={layout.labelRow}>
        <AppText variant="chip" tone="ink">
          {label}
        </AppText>
        {optionalLabel ? (
          <View style={styles.optional}>
            <AppText variant="caption" style={layout.optionalText}>
              {optionalLabel}
            </AppText>
          </View>
        ) : null}
      </View>
      <View style={layout.inputRow}>
        {prefix ? (
          <View style={styles.prefix}>
            <AppText variant="h3">{prefix}</AppText>
          </View>
        ) : null}
        <Animated.View
          style={[layout.inputFrame, styles.inputFrame, prefix ? layout.inputFrameAfterPrefix : null, borderStyle]}
        >
          <TextInput
            {...input}
            ref={inputRef}
            testID={testID}
            accessibilityLabel={label}
            accessibilityState={{ disabled: false }}
            secureTextEntry={password && !revealed}
            autoCorrect={false}
            autoCapitalize={input.autoCapitalize ?? 'none'}
            placeholderTextColor={colors.muted}
            onFocus={() => setFocused(true)}
            onBlur={event => {
              setFocused(false);
              input.onBlur?.(event);
            }}
            style={[layout.input, styles.input, password || showTrailingSpinner ? layout.inputWithTrailing : null]}
          />
          {password ? (
            <Pressable
              testID={`${testID}-toggle`}
              accessibilityLabel={revealed ? t('auth.fields.hidePassword') : t('auth.fields.showPassword')}
              hitSlop={spacing[4]}
              style={layout.trailing}
              onPress={() => setRevealed(current => !current)}
            >
              <Icon name={revealed ? 'eyeOff' : 'eye'} color={colors.stone} size={24} />
            </Pressable>
          ) : null}
          {showTrailingSpinner ? (
            <View style={layout.trailing} pointerEvents="none">
              <ActivityIndicator color={colors.teal700} accessibilityLabel={statusText} />
            </View>
          ) : null}
        </Animated.View>
      </View>
      {state !== 'pristine' && (error || statusText) ? (
        <Animated.View
          entering={fade}
          testID={statusTestID ?? `${testID}-status`}
          accessible
          accessibilityLiveRegion="polite"
          accessibilityValue={{ text: state }}
          style={layout.statusRow}
        >
          {state === 'success' ? (
            <Icon name="checkCircle" color={colors.pine} accent={colors.white} size={18} />
          ) : null}
          <AppText
            variant="small"
            testID={error ? `${testID}-error` : undefined}
            style={state === 'error' ? styles.errorText : state === 'success' ? styles.successText : undefined}
          >
            {error ?? statusText}
          </AppText>
        </Animated.View>
      ) : null}
      {hint ? <AppText variant="small">{hint}</AppText> : null}
    </View>
  );
}

const layout = StyleSheet.create({
  field: { gap: spacing[8] },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[8] },
  optionalText: { textTransform: 'none', letterSpacing: 0 },
  inputRow: { flexDirection: 'row', alignItems: 'stretch' },
  inputFrame: {
    flex: 1,
    minHeight: sizes.inputMinHeight,
    justifyContent: 'center',
    borderWidth: borders.card,
    borderRadius: radii.input,
  },
  inputFrameAfterPrefix: {
    borderTopStartRadius: 0,
    borderBottomStartRadius: 0,
  },
  input: {
    ...typography.body,
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[14],
  },
  inputWithTrailing: { paddingEnd: sizes.touchTarget + spacing[8] },
  trailing: {
    position: 'absolute',
    end: spacing[4],
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[6] },
});

const useStyles = createThemedStyles(c => ({
  inputFrame: { backgroundColor: c.card },
  input: { color: c.ink },
  prefix: {
    minHeight: sizes.inputMinHeight,
    justifyContent: 'center',
    paddingHorizontal: spacing[12],
    borderWidth: borders.card,
    borderEndWidth: 0,
    borderColor: c.line,
    borderTopStartRadius: radii.input,
    borderBottomStartRadius: radii.input,
    backgroundColor: c.soft,
  },
  optional: {
    borderRadius: radii.pill,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[8],
    backgroundColor: c.soft,
  },
  errorText: { color: c.red700 },
  successText: { color: conditionColors.go.chipFg },
}));
