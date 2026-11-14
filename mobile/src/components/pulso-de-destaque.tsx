import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { TextColor } from '@/constants/design-system';

type Props = {
  /** Cada valor novo (maior que zero) dispara o pulso uma vez. */
  disparo: number;
  /** Mesmo arredondamento da caixa destacada. */
  borderRadius: number;
  /** Espera antes de pulsar, por exemplo o tempo da rolagem até a caixa. */
  atraso?: number;
};

// Branco do design system (marfim)
const COR = TextColor.primary;
const DURACAO = 650;

/**
 * Anel branco que pulsa duas vezes em volta de uma caixa, para mostrar onde a pessoa chegou.
 * Fica por cima da caixa sem receber toques. Com "reduzir movimento", só acende e apaga.
 */
export function PulsoDeDestaque({ disparo, borderRadius, atraso = 0 }: Props) {
  const progresso = useSharedValue(0);
  const reduzirMovimento = useReducedMotion();

  useEffect(() => {
    if (disparo <= 0) return;
    const uma = () =>
      withSequence(
        withTiming(0, { duration: 0 }),
        withTiming(1, { duration: DURACAO, easing: Easing.out(Easing.quad) }),
      );
    progresso.value = withDelay(atraso, withSequence(uma(), uma(), withTiming(0, { duration: 0 })));
  }, [disparo, atraso, progresso]);

  const estilo = useAnimatedStyle(() => {
    // 0 → 1: o anel acende rápido e some enquanto se afasta um pouco da caixa
    const p = progresso.value;
    const opacidade = p === 0 ? 0 : p < 0.25 ? (p / 0.25) * 0.9 : 0.9 * (1 - (p - 0.25) / 0.75);
    return {
      opacity: opacidade,
      transform: [{ scale: reduzirMovimento ? 1 : 1 + p * 0.04 }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.anel, { borderRadius }, estilo]}
    />
  );
}

const styles = StyleSheet.create({
  anel: {
    // 1 px para fora, por cima da borda da caixa
    position: 'absolute',
    top: -1,
    left: -1,
    right: -1,
    bottom: -1,
    borderWidth: 2,
    borderColor: COR,
    // brilho suave em volta do anel
    shadowColor: COR,
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
});
