import '@/global.css';

import { Platform } from 'react-native';

import { Accent, Ink, Mint, TextColor } from '@/constants/design-system';

const paleta = {
  text: TextColor.primary,
  textSecondary: TextColor.secondary,
  textMuted: TextColor.muted,
  background: Ink.ink900,
  backgroundElement: Ink.ink700,
  backgroundSelected: Ink.ink600,
  accent: Mint.mint400,
  danger: Accent.coral,
  border: Ink.ink500,
} as const;

export const Colors = { light: paleta, dark: paleta } as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
