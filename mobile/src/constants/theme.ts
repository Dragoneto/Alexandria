import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#ffffff',
    textSecondary: '#ccd6f6',
    textMuted: '#8892b0',
    background: '#0a192f',
    backgroundElement: '#112240',
    backgroundSelected: '#1d2d44',
    accent: '#64ffda',
    danger: '#ff7b72',
    border: 'rgba(100, 255, 218, 0.12)',
  },
  dark: {
    text: '#ffffff',
    textSecondary: '#ccd6f6',
    textMuted: '#8892b0',
    background: '#0a192f',
    backgroundElement: '#112240',
    backgroundSelected: '#1d2d44',
    accent: '#64ffda',
    danger: '#ff7b72',
    border: 'rgba(100, 255, 218, 0.12)',
  },
} as const;

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