import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { MessageBanner } from '@/components/message-banner';
import { createMessageQueue, type Message } from '@/services/messages';

type MessagesApi = {
  success(text: string): void;
  error(text: string): void;
  warning(text: string): void;
  info(text: string): void;
};

const MessagesContext = createContext<MessagesApi | null>(null);

export function MessagesProvider({ children }: PropsWithChildren) {
  const queue = useMemo(() => createMessageQueue(), []);
  const [message, setMessage] = useState<Message | null>(null);
  // Altura ocupada pela faixa: o conteúdo desce junto para nada ficar coberto
  const shift = useSharedValue(0);

  useEffect(() => queue.subscribe(setMessage), [queue]);

  const contentStyle = useAnimatedStyle(() => ({ paddingTop: shift.value }));

  const api = useMemo<MessagesApi>(
    () => ({
      success: (text) => {
        queue.push('success', text);
      },
      error: (text) => {
        queue.push('error', text);
      },
      warning: (text) => {
        queue.push('warning', text);
      },
      info: (text) => {
        queue.push('info', text);
      },
    }),
    [queue],
  );

  return (
    <MessagesContext.Provider value={api}>
      <Animated.View style={[styles.content, contentStyle]}>{children}</Animated.View>

      {/* box-none deixa o toque passar para a tela onde não há faixa */}
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        {message ? (
          <MessageBanner message={message} onDismiss={queue.dismiss} shift={shift} />
        ) : null}
      </View>
    </MessagesContext.Provider>
  );
}

export function useMessages() {
  const context = useContext(MessagesContext);
  if (!context) throw new Error('useMessages precisa de MessagesProvider.');
  return context;
}

const styles = StyleSheet.create({
  content: { flex: 1 },
});
