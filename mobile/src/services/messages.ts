/**
 * Regra das mensagens da interface, sem React.
 *
 * A fila guarda uma mensagem por vez: a nova entra no lugar da que estiver na
 * tela. O contexto (contexts/messages-context.tsx) só liga isso ao React.
 */

export type MessageKind = 'success' | 'error' | 'warning' | 'info';

export type Message = {
  id: number;
  kind: MessageKind;
  text: string;
  durationMs: number;
};

/** Erro pede uma ação de quem lê, então fica o dobro do tempo na tela. */
export const MESSAGE_DURATION_MS: Record<MessageKind, number> = {
  success: 2000,
  info: 2000,
  warning: 2000,
  error: 4000,
};

type Listener = (message: Message | null) => void;

export type MessageQueue = {
  current(): Message | null;
  subscribe(listener: Listener): () => void;
  push(kind: MessageKind, text: string): Message | null;
  dismiss(id: number): void;
};

export function createMessageQueue(): MessageQueue {
  let current: Message | null = null;
  let listeners: Listener[] = [];
  let lastId = 0;

  const notify = () => {
    for (const listener of [...listeners]) listener(current);
  };

  return {
    current: () => current,

    subscribe(listener) {
      listeners.push(listener);
      return () => {
        listeners = listeners.filter((candidate) => candidate !== listener);
      };
    },

    push(kind, text) {
      const trimmed = text.trim();
      if (!trimmed) return current;

      lastId += 1;
      current = { id: lastId, kind, text: trimmed, durationMs: MESSAGE_DURATION_MS[kind] };
      notify();

      return current;
    },

    dismiss(id) {
      // Sem esta checagem, o fim da contagem de uma mensagem antiga derrubaria
      // a mensagem nova que entrou no lugar dela
      if (!current || current.id !== id) return;

      current = null;
      notify();
    },
  };
}
