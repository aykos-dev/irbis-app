import type { TextStyle } from 'react-native';

/**
 * Typography tokens. Mirrors irbis-docs/design/design.md (Typography — Nunito) verbatim.
 * Weight is chosen by family name, never `fontWeight` (Android ignores numeric weights for
 * custom families). Line heights are size × the design ratio; letter-spacing is em × size.
 */
export const fontFamily = {
  semiBold: 'Nunito-SemiBold', // 600
  bold: 'Nunito-Bold', // 700
  extraBold: 'Nunito-ExtraBold', // 800
  black: 'Nunito-Black', // 900
} as const;

type TypeToken = Pick<
  TextStyle,
  'fontFamily' | 'fontSize' | 'lineHeight' | 'letterSpacing' | 'textTransform' | 'fontVariant'
>;

export const typography = {
  stat: {
    fontFamily: fontFamily.black,
    fontSize: 48,
    lineHeight: 48,
    fontVariant: ['tabular-nums'],
  },
  h1: { fontFamily: fontFamily.black, fontSize: 28, lineHeight: 32.2 },
  h2: { fontFamily: fontFamily.black, fontSize: 22, lineHeight: 26.4 },
  h3: { fontFamily: fontFamily.extraBold, fontSize: 17, lineHeight: 21.25 },
  body: { fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 21.75 },
  small: { fontFamily: fontFamily.bold, fontSize: 13, lineHeight: 17.55 },
  caption: {
    fontFamily: fontFamily.black,
    fontSize: 12,
    letterSpacing: 0.96,
    textTransform: 'uppercase',
  },
  button: {
    fontFamily: fontFamily.black,
    fontSize: 17,
    lineHeight: 19.55,
    letterSpacing: 0.85,
    textTransform: 'uppercase',
  },
  navLabel: { fontFamily: fontFamily.extraBold, fontSize: 11 },
  chip: { fontFamily: fontFamily.extraBold, fontSize: 13 },
} as const satisfies Record<string, TypeToken>;

export type TypographyToken = keyof typeof typography;
