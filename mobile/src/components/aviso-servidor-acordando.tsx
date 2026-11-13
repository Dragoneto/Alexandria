import { StyleSheet, Text } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { DSFonts, TextColor } from '@/constants/design-system';
import { useLoadingGate } from '@/hooks/use-loading-gate';

/**
 * O backend no plano grátis do Render dorme quando fica parado e leva até um minuto
 * para acordar. Se a espera passar de alguns segundos, avisa em vez de só girar.
 */
export function AvisoServidorAcordando({ carregando }: { carregando: boolean }) {
  const demorando = useLoadingGate(carregando, 5000, 0);
  if (!demorando) return null;
  return (
    <Animated.View entering={FadeIn.duration(300)}>
      <Text accessibilityLiveRegion="polite" style={styles.texto}>
        O servidor está acordando. Na primeira vez do dia isso pode levar até um minuto.
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  texto: {
    fontFamily: DSFonts.ui,
    fontSize: 13,
    lineHeight: 20,
    color: TextColor.secondary,
    textAlign: 'center',
  },
});
