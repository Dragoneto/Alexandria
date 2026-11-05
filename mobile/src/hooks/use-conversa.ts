import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '@/services/api';
import { buscarAvaliacao, type AvaliacaoLida } from '@/services/avaliacoes';
import {
  juntarComentarios,
  listarPaginaComentarios,
  type Comentario,
} from '@/services/comentarios';

export type ListaDaConversa = {
  cursor: number | null;
  temMais: boolean;
  carregando: boolean;
  erro: string;
};

const RAIZ = 'raiz';
const LISTA_NOVA: ListaDaConversa = { cursor: null, temMais: true, carregando: false, erro: '' };
const chaveDaLista = (paiId: number | null) => (paiId === null ? RAIZ : String(paiId));

function mensagemDeErro(error: unknown) {
  return error instanceof ApiError && (error.kind === 'network' || error.kind === 'timeout')
    ? 'Sem conexão com o servidor. Confira a internet e tente de novo.'
    : 'Não foi possível carregar a conversa agora.';
}

export function useConversa(avaliacaoId: number) {
  const valido = Number.isInteger(avaliacaoId) && avaliacaoId > 0;
  const [avaliacao, setAvaliacao] = useState<AvaliacaoLida | null>(null);
  const [comentarios, setComentarios] = useState<Comentario[] | null>(null);
  const [listas, setListas] = useState<Record<string, ListaDaConversa>>({});
  const [carregando, setCarregando] = useState(valido);
  const [erro, setErro] = useState('');
  const [inexistente, setInexistente] = useState(!valido);
  const atual = useRef<AbortController | null>(null);
  const atualizando = useRef(false);
  const listasAtuais = useRef(listas);
  useEffect(() => {
    listasAtuais.current = listas;
  }, [listas]);

  const percorrer = useCallback(
    async (paiId: number | null, ate: number | null, signal: AbortSignal) => {
      const itens: Comentario[] = [];
      let cursor: number | null = null;
      let temMais = true;
      while (temMais) {
        const pagina = await listarPaginaComentarios(
          avaliacaoId,
          { paiId: paiId ?? undefined, cursor },
          signal,
        );
        itens.push(...pagina.comentarios);
        cursor = pagina.proximoCursor;
        temMais = pagina.temMais;
        if (ate === null || cursor === null || cursor >= ate) break;
      }
      return { itens, lista: { cursor, temMais, carregando: false, erro: '' } };
    },
    [avaliacaoId],
  );

  const carregar = useCallback(async () => {
    if (!valido) return;
    atual.current?.abort();
    const controller = new AbortController();
    atual.current = controller;
    atualizando.current = true;
    setCarregando(true);
    setErro('');
    try {
      const abertas = Object.entries(listasAtuais.current);
      const alvos: [number | null, number | null][] = abertas.length
        ? abertas.map(([chave, lista]) => [chave === RAIZ ? null : Number(chave), lista.cursor])
        : [[null, null]];
      const [lida, ...percorridas] = await Promise.all([
        buscarAvaliacao(avaliacaoId, controller.signal),
        ...alvos.map(([paiId, ate]) => percorrer(paiId, ate, controller.signal)),
      ]);
      if (controller.signal.aborted) return;
      setAvaliacao(lida);
      setComentarios((anteriores) =>
        percorridas.reduce((lista, { itens }) => juntarComentarios(lista, itens), anteriores ?? []),
      );
      setListas(
        Object.fromEntries(alvos.map(([paiId], i) => [chaveDaLista(paiId), percorridas[i].lista])),
      );
      setInexistente(false);
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof ApiError && error.status === 404) {
        setInexistente(true);
        return;
      }
      setErro(mensagemDeErro(error));
    } finally {
      if (atual.current === controller && !controller.signal.aborted) {
        atualizando.current = false;
        setCarregando(false);
      }
    }
  }, [avaliacaoId, valido, percorrer]);

  const carregarMais = useCallback(
    async (paiId: number | null) => {
      const chave = chaveDaLista(paiId);
      const lista = listasAtuais.current[chave];
      if (lista?.carregando || atualizando.current) return;
      const signal = atual.current?.signal;
      const marcar = (mudanca: Partial<ListaDaConversa>) =>
        setListas((todas) => ({
          ...todas,
          [chave]: { ...(todas[chave] ?? LISTA_NOVA), ...mudanca },
        }));
      marcar({ carregando: true, erro: '' });
      try {
        const pagina = await listarPaginaComentarios(
          avaliacaoId,
          { paiId: paiId ?? undefined, cursor: lista?.cursor ?? null },
          signal,
        );
        if (signal?.aborted) return;
        setComentarios((anteriores) => juntarComentarios(anteriores ?? [], pagina.comentarios));
        marcar({ cursor: pagina.proximoCursor, temMais: pagina.temMais, carregando: false });
      } catch (error) {
        if (signal?.aborted) return;
        marcar({ carregando: false, erro: mensagemDeErro(error) });
      }
    },
    [avaliacaoId],
  );

  const incluir = useCallback((comentario: Comentario) => {
    setComentarios((anteriores) => juntarComentarios(anteriores ?? [], [comentario]));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void carregar();
      return () => atual.current?.abort();
    }, [carregar]),
  );

  return {
    avaliacao,
    comentarios,
    listas,
    carregando,
    erro,
    inexistente,
    recarregar: carregar,
    carregarMais,
    incluir,
  };
}
