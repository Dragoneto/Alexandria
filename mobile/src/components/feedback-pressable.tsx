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
  disabled?: boolean;
  loading?: boolean;
  loadingColor?: string;
};

/** Press feedback, disabled state and a size-preserving inline loading overlay. */
export function FeedbackPressable({
  children,
  style,
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
        style={styles.content}
        accessibilityElementsHidden={loading}
        importantForAccessibility={loading ? 'no-hide-descendants' : 'auto'}>
        {children}
      </View>
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
  indicator: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});
