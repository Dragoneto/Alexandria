import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Comentario } from '@/services/comentarios';
import {
  descartarRascunho,
  lerRascunho,
  listarRascunhosDaAvaliacao,
  salvarRascunho,
  type AlvoRascunho,
  type RascunhoSalvo,
} from '@/services/rascunhos';

const ESPERA_PARA_SALVAR_MS = 400;

type Opcoes = {
  usuarioId: number | null;
  avaliacaoId: number;
  paiId: number | null;
  ativo: boolean;
  texto: string;
  setTexto: (texto: string) => void;
  comentarios: Comentario[] | null;
  inexistente: boolean;
};

export function useRascunhos({
  usuarioId,
  avaliacaoId,
  paiId,
  ativo,
  texto,
  setTexto,
  comentarios,
  inexistente,
}: Opcoes) {
  const [restauradoPara, setRestauradoPara] = useState<AlvoRascunho | null>(null);
  const [orfaos, setOrfaos] = useState<RascunhoSalvo[]>([]);
  const pronto = useRef(false);
  const ultimoSalvo = useRef('');
  const pendente = useRef<{ alvo: AlvoRascunho; texto: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const alvo = useMemo<AlvoRascunho | null>(
    () => (ativo && usuarioId ? { usuarioId, avaliacaoId, paiId } : null),
    [ativo, usuarioId, avaliacaoId, paiId],
  );

  const gravar = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const atual = pendente.current;
    pendente.current = null;
    if (atual) void salvarRascunho(atual.alvo, atual.texto).catch(() => {});
  }, []);

  useEffect(() => {
    gravar();
    pronto.current = false;
    if (!alvo) return;
    let vigente = true;
    void lerRascunho(alvo)
      .catch(() => null)
      .then((salvo) => {
        if (!vigente) return;
        ultimoSalvo.current = salvo ?? '';
        setTexto(salvo ?? '');
        setRestauradoPara(salvo ? alvo : null);
        pronto.current = true;
      });
    return () => {
      vigente = false;
    };
  }, [alvo, gravar, setTexto]);

  useEffect(() => {
    if (!alvo || !pronto.current || texto === ultimoSalvo.current) return;
    ultimoSalvo.current = texto;
    pendente.current = { alvo, texto };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(gravar, ESPERA_PARA_SALVAR_MS);
  }, [alvo, texto, gravar]);

  useEffect(() => gravar, [gravar]);

  useEffect(() => {
    if (!usuarioId || (!comentarios && !inexistente)) return;
    let vigente = true;
    const removidos = new Set((comentarios ?? []).filter((c) => c.removido).map((c) => c.id));
    void listarRascunhosDaAvaliacao(usuarioId, avaliacaoId)
      .then((todos) => {
        if (!vigente) return;
        setOrfaos(todos.filter((r) => inexistente || (r.paiId !== null && removidos.has(r.paiId))));
      })
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, [usuarioId, avaliacaoId, comentarios, inexistente]);

  const esquecer = useCallback(
    (paiIdDoRascunho: number | null) => {
      if (!usuarioId) return Promise.resolve();
      setOrfaos((atuais) => atuais.filter((orfao) => orfao.paiId !== paiIdDoRascunho));
      return descartarRascunho({ usuarioId, avaliacaoId, paiId: paiIdDoRascunho }).catch(() => {});
    },
    [usuarioId, avaliacaoId],
  );

  const confirmarEnvio = useCallback(
    (paiIdEnviado: number | null) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      pendente.current = null;
      ultimoSalvo.current = '';
      setRestauradoPara(null);
      return esquecer(paiIdEnviado);
    },
    [esquecer],
  );

  const descartarAtual = () => {
    setTexto('');
    return confirmarEnvio(paiId);
  };

  const usarComoComentario = async (orfao: RascunhoSalvo) => {
    if (!usuarioId) return;
    const raiz = { usuarioId, avaliacaoId, paiId: null };
    const naTela = ativo && paiId === null;
    const atual = naTela ? texto : ((await lerRascunho(raiz).catch(() => null)) ?? '');
    const junto = atual.trim() ? `${atual}\n\n${orfao.texto}` : orfao.texto;
    await salvarRascunho(raiz, junto).catch(() => {});
    await esquecer(orfao.paiId);
    if (naTela) {
      ultimoSalvo.current = junto;
      setTexto(junto);
    }
  };

  return {
    restaurado: !!alvo && restauradoPara === alvo,
    orfaos,
    confirmarEnvio,
    descartarAtual,
    descartarOrfao: esquecer,
    usarComoComentario,
  };
}
