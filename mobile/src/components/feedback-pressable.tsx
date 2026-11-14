import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useCallback, type ReactNode } from 'react';

import { DisabledOpacity, Mint } from '@/constants/design-system';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'disabled' | 'style' | 'children'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /**
   * Estilo do miolo que embrulha os filhos. Use para layouts em linha (flexDirection, gap) e
   * para aumentar a área de toque sem mudar o visual: o espaçamento fica no `style` (invisível)
   * e a borda e o fundo ficam aqui.
   */
  contentStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
  /** Algo desenhado por cima do cartão inteiro (fora do miolo), como um indicador no canto. */
  overlay?: ReactNode;
  loading?: boolean;
  loadingColor?: string;
};

/** Press feedback, disabled state and a size-preserving inline loading overlay. */
export function FeedbackPressable({
  children,
  style,
  contentStyle,
  overlay,
  disabled = false,
  loading = false,
  loadingColor = Mint.mint400,
  onPressIn,
  onPressOut,
  ...props
}: Props) {
  const reduceMotion = useReducedMotion();
  const pressed = useSharedValue(1);
  const setPressed = useCallback(
    (value: number) => {
      pressed.set(reduceMotion ? value : withTiming(value, { duration: 140 }));
    },
    [pressed, reduceMotion],
  );
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: disabled || loading ? DisabledOpacity : pressed.value,
  }));

  return (
    <AnimatedPressable
      {...props}
      disabled={disabled || loading}
      accessibilityState={{
        ...props.accessibilityState,
        disabled: disabled || loading,
        busy: loading,
      }}
      onPressIn={(event) => {
        setPressed(0.72);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(1);
        onPressOut?.(event);
      }}
      style={[style, animatedStyle]}>
      <View
        // O rótulo some (sem sair do layout) para o indicador não ficar por cima do texto.
        style={[styles.content, contentStyle, loading && styles.contentLoading]}
        accessibilityElementsHidden={loading}
        importantForAccessibility={loading ? 'no-hide-descendants' : 'auto'}>
        {children}
      </View>
      {overlay}
      {loading && (
        <View style={styles.indicator} pointerEvents="none">
          <ActivityIndicator color={loadingColor} />
        </View>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  content: { opacity: 1 },
  contentLoading: { opacity: 0 },
  indicator: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});
