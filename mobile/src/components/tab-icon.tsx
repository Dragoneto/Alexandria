import { useEffect } from 'react';
import { ImageSourcePropType } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  source: ImageSourcePropType;
  focused: boolean;
  size: number;
  activeColor: string;
  inactiveColor: string;
};

export function TabIcon({ source, focused, size, activeColor, inactiveColor }: Props) {
  // 0 = aba inativa, 1 = aba ativa
  const progress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(focused ? 1 : 0, { duration: 250 });
  }, [focused, progress]);

  // Só a cor muda (cinza → verde), sem crescer nem balançar
  const iconStyle = useAnimatedStyle(() => ({
    tintColor: interpolateColor(progress.value, [0, 1], [inactiveColor, activeColor]),
  }));

  return (
    <Animated.Image
      source={source}
      resizeMode="contain"
      style={[{ width: size, height: size }, iconStyle]}
    />
  );
}
