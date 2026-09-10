/**
 * Alexandria Mobile — tokens do design system (v1.0).
 *
 * Transcrição fiel do documento "Alexandria Mobile Design System":
 * base azul-noite em cinco degraus, menta como única cor de ação,
 * acentos restritos a avatares, selos e estados. Dark-first, grid de 4 pt.
 */

import { Platform } from 'react-native';

/** Base — azul-noite */
export const Ink = {
  /** Nanquim · fundo do app */
  ink900: '#071324',
  /** Noite · seções, barras */
  ink800: '#0B1A31',
  /** Superfície · cartões, listas */
  ink700: '#12213B',
  /** Elevada · chips, sheets, input */
  ink600: '#1A2B49',
  /** Borda · traços, divisores */
  ink500: '#26395C',
} as const;

/** Ação — menta */
export const Mint = {
  /** Hover de texto, foco */
  mint200: '#A7F3E4',
  /** Primária, marca */
  mint400: '#5EEAD4',
  /** Pressed, gradiente */
  mint500: '#2FD3B4',
  /** Fundo de selo */
  mint900: '#123F3C',
} as const;

/** Acentos e estados */
export const Accent = {
  /** Info, avatar */
  sapphire: '#3B82F6',
  /** Avaliação, aviso */
  amber: '#FBBF24',
  /** Erro, favorito */
  coral: '#F87171',
  /** Sucesso, lido */
  laurel: '#34D399',
  /** Comunidade */
  lilac: '#C4B5FD',
} as const;

/** Texto sobre fundo escuro */
export const TextColor = {
  /** Marfim — primário · 15,1:1 */
  primary: '#F1F5F9',
  /** Névoa — secundário · 7,4:1 */
  secondary: '#A9B7CE',
  /** Sussurro — auxiliar · 3,6:1 · só >= 16px */
  muted: '#6B7D99',
} as const;

/**
 * Duas famílias: serifa editorial para títulos, nomes de obras e citações;
 * sans do sistema para botões, rótulos, corpo e navegação.
 */
export const DSFonts = Platform.select({
  ios: { display: 'Georgia', ui: 'system-ui' },
  android: { display: 'serif', ui: 'sans-serif' },
  default: { display: 'serif', ui: 'System' },
  web: { display: "Georgia, 'Iowan Old Style', serif", ui: 'var(--font-display)' },
});

/** Escala de espaço — grid de 4 pt */
export const Space = {
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  six: 24,
  eight: 32,
  twelve: 48,
} as const;

/** Margem lateral da tela */
export const ScreenInset = 20;
/** Alvo mínimo de toque */
export const TouchMin = 44;

export const Radius = {
  cover: 8,
  card: 14,
  sheet: 22,
  pill: 999,
} as const;

/**
 * Converte um token hexadecimal (#RRGGBB) em rgba, para véus e bordas suaves
 * derivados das cores da paleta em vez de valores avulsos.
 */
export function withAlpha(hex: string, alpha: number): string {
  const value = parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Sombras — e1 cartão, e2 sheet, glow ação */
export const Shadow = {
  e1: {
    shadowColor: '#030810',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  e2: {
    shadowColor: '#030810',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.62,
    shadowRadius: 28,
    elevation: 12,
  },
  glow: {
    shadowColor: Mint.mint400,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 10,
  },
} as const;
