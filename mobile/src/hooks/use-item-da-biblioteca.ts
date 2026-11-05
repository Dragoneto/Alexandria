import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { ApiError } from '@/services/api';
import {
  adicionarNaBiblioteca,
  comTrava,
  encontrarItemDoLivro,
  listarBiblioteca,
  removerDaBiblioteca,
  trocarStatusOtimista,
  type BibliotecaItem,
  type StatusLeitura,
} from '@/services/biblioteca';

export type AcaoNaBiblioteca = 'adicionar' | 'status' | 'remover';

function mensagem(error: unknown, padrao: string): string {
  return error instanceof ApiError ? error.message : padrao;
}

// Consulta se o livro está na biblioteca antes de mostrar as ações e recarrega ao ganhar foco.
export function useItemDaBiblioteca(livroId: string) {
  const [item, setItem] = useState<BibliotecaItem | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState<AcaoNaBiblioteca | null>(null);
  const [erroAcao, setErroAcao] = useState('');
  const pendentes = useRef(new Set<string>());
  const controllerConsulta = useRef<AbortController | null>(null);
  // Muda a cada ação; uma consulta que viu outra versão traz dados de antes da ação e é descartada.
  const versao = useRef(0);

  const consultar = useCallback(async () => {
    controllerConsulta.current?.abort();
    const controller = new AbortController();
    controllerConsulta.current = controller;
    await Promise.resolve();
    if (controller.signal.aborted || !livroId) return;
    const versaoInicial = versao.current;
    try {
      const itens = await listarBiblioteca(controller.signal);
      if (
        controller.signal.aborted ||
        pendentes.current.has(livroId) ||
        versao.current !== versaoInicial
      )
        return;
      setItem(encontrarItemDoLivro(itens, livroId));
      setErro('');
      setErroAcao('');
    } catch (error) {
      if (controller.signal.aborted) return;
      setErro(mensagem(error, 'Não foi possível consultar sua biblioteca.'));
    } finally {
      if (!controller.signal.aborted) setCarregando(false);
    }
  }, [livroId]);

  useFocusEffect(
    useCallback(() => {
      void consultar();
      return () => controllerConsulta.current?.abort();
    }, [consultar]),
  );

  const tentarNovamente = () => {
    setCarregando(true);
    setErro('');
    void consultar();
  };

  const executar = (acao: AcaoNaBiblioteca, tarefa: () => Promise<void>) =>
    comTrava(pendentes.current, livroId, async () => {
      controllerConsulta.current?.abort();
      versao.current += 1;
      setSalvando(acao);
      setErroAcao('');
      try {
        await tarefa();
      } finally {
        versao.current += 1;
        setSalvando(null);
      }
    });

  const adicionar = () =>
    executar('adicionar', async () => {
      try {
        setItem(await adicionarNaBiblioteca(livroId));
      } catch (error) {
        // 409: outra tela já adicionou; a consulta mostra o status real.
        if (error instanceof ApiError && error.status === 409) {
          try {
            setItem(encontrarItemDoLivro(await listarBiblioteca(), livroId));
          } catch (falhaNaConsulta) {
            setErroAcao(mensagem(falhaNaConsulta, 'Não foi possível consultar sua biblioteca.'));
          }
          return;
        }
        setErroAcao(mensagem(error, 'Não foi possível adicionar o livro.'));
      }
    });

  const trocarStatus = (status: StatusLeitura) => {
    const atual = item;
    if (!atual || atual.statusLeitura === status) return Promise.resolve(false);
    return executar('status', async () => {
      try {
        await trocarStatusOtimista(atual, status, setItem);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          setItem(null);
          setErroAcao('Este livro já não estava na sua biblioteca.');
          return;
        }
        setErroAcao(mensagem(error, 'Não foi possível alterar o status.'));
      }
    });
  };

  const remover = () => {
    const atual = item;
    if (!atual) return Promise.resolve(false);
    return executar('remover', async () => {
      try {
        await removerDaBiblioteca(atual.id);
        setItem(null);
      } catch (error) {
        // 404: já tinha saído da biblioteca, então o resultado é o mesmo.
        if (error instanceof ApiError && error.status === 404) {
          setItem(null);
          return;
        }
        setErroAcao(mensagem(error, 'Não foi possível remover o livro.'));
      }
    });
  };

  return {
    item,
    carregando,
    erro,
    salvando,
    erroAcao,
    tentarNovamente,
    adicionar,
    trocarStatus,
    remover,
  };
}
