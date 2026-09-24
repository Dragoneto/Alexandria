import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import {
  Accent,
  DSFonts,
  Ink,
  Mint,
  Radius,
  Shadow,
  TouchMin,
  withAlpha,
} from '@/constants/design-system';

type ActionButtonProps = {
  label: string;
  onPress: () => void;
  /** `primary` é a pílula de menta com glow; `ghost` é a contornada; `danger` é a ação destrutiva. */
  variant?: 'primary' | 'ghost' | 'danger';
  accessibilityLabel?: string;
  /** Mostra o indicador de carregamento e bloqueia novos toques. */
  loading?: boolean;
};

/** Botão de ação do design system — menta é a cor de ação; coral só para destruir. */
export function ActionButton({
  label,
  onPress,
  variant = 'primary',
  accessibilityLabel,
  loading = false,
}: ActionButtonProps) {
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  // Menta e coral são pílulas cheias; ghost é a contornada
  const filled = isPrimary || isDanger;

  const fill = isPrimary ? styles.primary : isDanger ? styles.danger : styles.ghost;
  const fillPressed = isPrimary
    ? styles.primaryPressed
    : isDanger
      ? styles.dangerPressed
      : styles.ghostPressed;
  const labelColor = isPrimary
    ? styles.primaryLabel
    : isDanger
      ? styles.dangerLabel
      : styles.ghostLabel;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      aria-busy={loading}
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [styles.base, fill, pressed && fillPressed]}>
      {loading ? (
        <ActivityIndicator color={filled ? Ink.ink900 : Mint.mint400} />
      ) : (
        <Text style={[styles.label, labelColor]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'stretch',
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    minHeight: 52,
    backgroundColor: Mint.mint400,
    ...Shadow.glow,
  },
  primaryPressed: {
    backgroundColor: Mint.mint500,
  },
  danger: {
    minHeight: 52,
    backgroundColor: Accent.coral,
  },
  dangerPressed: {
    backgroundColor: withAlpha(Accent.coral, 0.82),
  },
  ghost: {
    minHeight: TouchMin,
    borderWidth: 1,
    borderColor: Mint.mint400,
  },
  ghostPressed: {
    backgroundColor: Mint.mint900,
  },
  // Rótulo forte · sans 16/22 · 700
  label: {
    fontFamily: DSFonts.ui,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
  primaryLabel: {
    color: Ink.ink900,
  },
  dangerLabel: {
    color: Ink.ink900,
  },
  ghostLabel: {
    color: Mint.mint400,
  },
});
