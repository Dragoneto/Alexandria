import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { ApiError } from '@/services/api';
import { buscarAvaliacao, type AvaliacaoLida } from '@/services/avaliacoes';
import { listarComentarios, type Comentario } from '@/services/comentarios';

export function useConversa(avaliacaoId: number) {
  const valido = Number.isInteger(avaliacaoId) && avaliacaoId > 0;
  const [avaliacao, setAvaliacao] = useState<AvaliacaoLida | null>(null);
  const [comentarios, setComentarios] = useState<Comentario[] | null>(null);
  const [carregando, setCarregando] = useState(valido);
  const [erro, setErro] = useState('');
  const [inexistente, setInexistente] = useState(!valido);
  const atual = useRef<AbortController | null>(null);

  const carregar = useCallback(async () => {
    if (!valido) return;
    atual.current?.abort();
    const controller = new AbortController();
    atual.current = controller;
    setCarregando(true);
    setErro('');
    try {
      const [lida, lista] = await Promise.all([
        buscarAvaliacao(avaliacaoId, controller.signal),
        listarComentarios(avaliacaoId, controller.signal),
      ]);
      if (controller.signal.aborted) return;
      setAvaliacao(lida);
      setComentarios(lista);
      setInexistente(false);
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof ApiError && error.status === 404) {
        setInexistente(true);
        return;
      }
      setErro(
        error instanceof ApiError && (error.kind === 'network' || error.kind === 'timeout')
          ? 'Sem conexão com o servidor. Confira a internet e tente de novo.'
          : 'Não foi possível carregar a conversa agora.',
      );
    } finally {
      // Abortada ao sair da tela: continua "carregando" até a próxima consulta.
      if (atual.current === controller && !controller.signal.aborted) setCarregando(false);
    }
  }, [avaliacaoId, valido]);

  // Recarrega ao abrir e ao voltar para a tela.
  useFocusEffect(
    useCallback(() => {
      void carregar();
      return () => atual.current?.abort();
    }, [carregar]),
  );

  return { avaliacao, comentarios, carregando, erro, inexistente, recarregar: carregar };
}
