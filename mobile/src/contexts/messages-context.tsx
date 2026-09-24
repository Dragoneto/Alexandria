import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

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

  useEffect(() => queue.subscribe(setMessage), [queue]);

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
      {children}

      {/* box-none deixa o toque passar para a tela onde não há faixa */}
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        {message ? (
          <MessageBanner key={message.id} message={message} onDismiss={queue.dismiss} />
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
