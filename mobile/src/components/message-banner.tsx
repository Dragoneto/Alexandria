import { SymbolView, SymbolViewProps } from 'expo-symbols';
import { useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Accent, DSFonts, Ink, Radius, Shadow, Space, TextColor } from '@/constants/design-system';
import type { Message, MessageKind } from '@/services/messages';

const ENTER_MS = 220;
const EXIT_MS = 180;
/** Altura usada antes do primeiro onLayout, só para a faixa começar fora da tela. */
const ESTIMATED_HEIGHT = 96;

const ICON: Record<MessageKind, SymbolViewProps['name']> = {
  success: { ios: 'checkmark', android: 'check', web: 'check' },
  error: { ios: 'exclamationmark', android: 'error', web: 'error' },
  warning: { ios: 'exclamationmark.triangle', android: 'warning', web: 'warning' },
  info: { ios: 'info.circle', android: 'info', web: 'info' },
};

const COLOR: Record<MessageKind, string> = {
  success: Accent.laurel,
  error: Accent.coral,
  warning: Accent.amber,
  info: Accent.sapphire,
};

type MessageBannerProps = {
  message: Message;
  onDismiss: (id: number) => void;
};

/** Faixa do topo: entra, preenche a barra de contagem e sai sozinha no fim. */
export function MessageBanner({ message, onDismiss }: MessageBannerProps) {
  const insets = useSafeAreaInsets();
  const color = COLOR[message.kind];

  const enter = useSharedValue(0);
  const progress = useSharedValue(0);
  const height = useSharedValue(ESTIMATED_HEIGHT);

  const leave = useCallback(() => {
    enter.value = withTiming(0, { duration: EXIT_MS }, (finished) => {
      if (finished) runOnJS(onDismiss)(message.id);
    });
  }, [enter, message.id, onDismiss]);

  useEffect(() => {
    enter.value = withTiming(1, { duration: ENTER_MS });
    progress.value = 0;
    progress.value = withTiming(1, { duration: message.durationMs }, (finished) => {
      if (finished) runOnJS(leave)();
    });
  }, [enter, leave, message.durationMs, progress]);

  const bannerStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (enter.value - 1) * height.value }],
  }));

  const barStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <Animated.View
      onLayout={(event) => {
        height.value = event.nativeEvent.layout.height;
      }}
      style={[
        styles.banner,
        { paddingTop: insets.top + Space.three, borderBottomColor: color },
        bannerStyle,
      ]}>
      <Pressable
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel={message.text}
        accessibilityHint="Toque para dispensar"
        onPress={leave}
        style={styles.content}>
        <Animated.View style={[styles.icon, { backgroundColor: color }]}>
          <SymbolView name={ICON[message.kind]} size={14} weight="bold" tintColor={Ink.ink900} />
        </Animated.View>

        <Text numberOfLines={3} style={styles.text}>
          {message.text}
        </Text>
      </Pressable>

      <Animated.View style={[styles.bar, { backgroundColor: color }, barStyle]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: Ink.ink700,
    borderBottomWidth: 1,
    paddingHorizontal: Space.four,
    paddingBottom: Space.three,
    ...Shadow.e2,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.three,
  },
  icon: {
    width: 24,
    height: 24,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Corpo pequeno · sans 13/20 · 500
  text: {
    flex: 1,
    fontFamily: DSFonts.ui,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
    color: TextColor.primary,
  },
  bar: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    height: 3,
  },
});
