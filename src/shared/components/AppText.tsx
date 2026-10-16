import { Text, type TextProps } from 'react-native';

import type { ThemeColors } from '../constants/colors';
import { typography, type TypographyToken } from '../constants/typography';
import { createThemedStyles } from '../contexts/theme';

export type TextTone = 'ink' | 'body' | 'muted' | 'teal700' | 'red700' | 'white' | 'onOrange';

type Props = TextProps & {
  variant?: TypographyToken;
  /** Defaults per design.md: headings ink, body body, small/caption muted. */
  tone?: TextTone;
};

const defaultTone: Record<TypographyToken, TextTone> = {
  stat: 'ink',
  h1: 'ink',
  h2: 'ink',
  h3: 'ink',
  body: 'body',
  small: 'muted',
  caption: 'muted',
  button: 'ink',
  navLabel: 'muted',
  chip: 'ink',
};

const toneColor = (c: ThemeColors): Record<TextTone, { color: string }> => ({
  ink: { color: c.ink },
  body: { color: c.body },
  muted: { color: c.muted },
  teal700: { color: c.teal700 },
  red700: { color: c.red700 },
  white: { color: c.white },
  onOrange: { color: c.onOrange },
});

const useToneStyles = createThemedStyles(toneColor);

export function AppText({ variant = 'body', tone, style, ...rest }: Props) {
  const tones = useToneStyles();
  return (
    <Text
      {...rest}
      style={[typography[variant], tones[tone ?? defaultTone[variant]], style]}
    />
  );
}
