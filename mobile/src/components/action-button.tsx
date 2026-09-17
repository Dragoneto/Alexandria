import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { DSFonts, Ink, Mint, Radius, Shadow, TouchMin } from '@/constants/design-system';

type ActionButtonProps = {
  label: string;
  onPress: () => void;
  /** `primary` é a pílula de menta com glow; `ghost` é a versão contornada. */
  variant?: 'primary' | 'ghost';
  accessibilityLabel?: string;
  /** Mostra o indicador de carregamento e bloqueia novos toques. */
  loading?: boolean;
};

/** Botão de ação do design system — menta é a única cor de ação. */
export function ActionButton({
  label,
  onPress,
  variant = 'primary',
  accessibilityLabel,
  loading = false,
}: ActionButtonProps) {
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      aria-busy={loading}
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        isPrimary ? styles.primary : styles.ghost,
        pressed && (isPrimary ? styles.primaryPressed : styles.ghostPressed),
      ]}>
      {loading ? (
        <ActivityIndicator color={isPrimary ? Ink.ink900 : Mint.mint400} />
      ) : (
        <Text style={[styles.label, isPrimary ? styles.primaryLabel : styles.ghostLabel]}>
          {label}
        </Text>
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
  ghostLabel: {
    color: Mint.mint400,
  },
});
