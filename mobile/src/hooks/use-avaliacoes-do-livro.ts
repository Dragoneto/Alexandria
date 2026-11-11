import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { ApiError } from '@/services/api';
import {
  juntarAvaliacoes,
  listarAvaliacoesDoLivro,
  type AvaliacoesDoLivro,
} from '@/services/avaliacoes';

function mensagemDeErro(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Não foi possível carregar as avaliações.';
}

// Recarrega ao ganhar foco: volta da criação, edição ou exclusão com lista, total e média novos.
export function useAvaliacoesDoLivro(livroId: string) {
  const [dados, setDados] = useState<AvaliacoesDoLivro | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [erroMais, setErroMais] = useState('');
  const [atualizando, setAtualizando] = useState(true);
  const [status, setStatus] = useState<'loading' | 'success' | 'empty' | 'error'>('loading');
  const controllerLista = useRef<AbortController | null>(null);
  const controllerMais = useRef<AbortController | null>(null);

  const carregar = useCallback(async () => {
    controllerLista.current?.abort();
    // Um "Ver mais" pendente seria juntado à página 1 nova e pularia páginas.
    controllerMais.current?.abort();
    controllerMais.current = null;
    const controller = new AbortController();
    controllerLista.current = controller;
    await Promise.resolve();
    if (controller.signal.aborted || !livroId) return;
    setAtualizando(true);
    setStatus('loading');
    setCarregandoMais(false);
    try {
      const primeira = await listarAvaliacoesDoLivro(livroId, 1, controller.signal);
      setDados(primeira);
      setStatus(primeira.total === 0 ? 'empty' : 'success');
      setErro('');
      setErroMais('');
    } catch (error) {
      if (controller.signal.aborted) return;
      setDados(null);
      setStatus('error');
      setErro(mensagemDeErro(error));
    } finally {
      if (!controller.signal.aborted) {
        setCarregando(false);
        setAtualizando(false);
      }
    }
  }, [livroId]);

  useFocusEffect(
    useCallback(() => {
      void carregar();
      return () => {
        controllerLista.current?.abort();
        controllerMais.current?.abort();
        controllerMais.current = null;
        setCarregandoMais(false);
      };
    }, [carregar]),
  );

  const tentarNovamente = () => {
    setCarregando(true);
    setErro('');
    void carregar();
  };

  const carregarMais = async () => {
    if (!dados?.hasMore || controllerMais.current) return;
    const controller = new AbortController();
    controllerMais.current = controller;
    setCarregandoMais(true);
    setErroMais('');
    try {
      const proxima = await listarAvaliacoesDoLivro(livroId, dados.page + 1, controller.signal);
      setDados((atual) =>
        atual
          ? { ...proxima, avaliacoes: juntarAvaliacoes(atual.avaliacoes, proxima.avaliacoes) }
          : atual,
      );
    } catch (error) {
      if (controller.signal.aborted) return;
      setErroMais(mensagemDeErro(error));
    } finally {
      if (controllerMais.current === controller) {
        controllerMais.current = null;
        setCarregandoMais(false);
      }
    }
  };

  const minha = dados?.avaliacoes.find((avaliacao) => avaliacao.minha) ?? null;

  return {
    dados,
    carregando,
    atualizando,
    status,
    erro,
    carregandoMais,
    erroMais,
    minha,
    tentarNovamente,
    carregarMais,
  };
}
