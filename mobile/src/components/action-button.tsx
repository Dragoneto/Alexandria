import { StyleSheet, Text } from 'react-native';

import { FeedbackPressable } from '@/components/feedback-pressable';
import {
  DSFonts,
  DisabledOpacity,
  Ink,
  Mint,
  Radius,
  Shadow,
  TouchMin,
} from '@/constants/design-system';

type ActionButtonProps = {
  label: string;
  onPress: () => void;
  /** `primary` é a pílula de menta com glow; `ghost` é a versão contornada. */
  variant?: 'primary' | 'ghost';
  accessibilityLabel?: string;
  /** Mostra o indicador de carregamento e bloqueia novos toques. */
  loading?: boolean;
  /** Bloqueia uma ação indisponível e informa o estado ao leitor de tela. */
  disabled?: boolean;
};

/** Botão de ação do design system — menta é a única cor de ação. */
export function ActionButton({
  label,
  onPress,
  variant = 'primary',
  accessibilityLabel,
  loading = false,
  disabled = false,
}: ActionButtonProps) {
  const isPrimary = variant === 'primary';
  const unavailable = disabled || loading;

  return (
    <FeedbackPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      aria-busy={loading}
      accessibilityState={{ disabled: unavailable, busy: loading }}
      disabled={unavailable}
      loading={loading}
      loadingColor={isPrimary ? Ink.ink900 : Mint.mint400}
      onPress={onPress}
      style={[
        styles.base,
        isPrimary ? styles.primary : styles.ghost,
        unavailable && styles.disabled,
      ]}>
      <Text style={[styles.label, isPrimary ? styles.primaryLabel : styles.ghostLabel]}>
        {label}
      </Text>
    </FeedbackPressable>
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
  ghost: {
    minHeight: TouchMin,
    borderWidth: 1,
    borderColor: Mint.mint400,
  },
  disabled: { opacity: DisabledOpacity },
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
