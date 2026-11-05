import { ApiError, apiRequest } from '@/services/api';

export type Comentario = {
  id: number;
  avaliacaoId: number;
  paiId: number | null;
  autor: { id: number; nome: string };
  texto: string | null;
  removido: boolean;
  criadoEm: string;
  atualizadoEm: string;
  /** Sobe a cada edição; editarComentario() manda a versão que a pessoa estava vendo. */
  versao: number;
  podeEditar: boolean;
  podeExcluir: boolean;
};

export type FalhaComentario =
  'validacao' | 'sessao' | 'permissao' | 'removido' | 'conflito' | 'rede' | 'servidor';

export function comentarioFrom(valor: unknown): Comentario {
  const dados = (valor ?? {}) as Partial<Comentario>;
  const autor = dados.autor;
  if (
    !Number.isInteger(dados.id) ||
    !Number.isInteger(dados.avaliacaoId) ||
    !Number.isInteger(dados.versao) ||
    !Number.isInteger(autor?.id) ||
    typeof autor?.nome !== 'string' ||
    typeof dados.criadoEm !== 'string' ||
    typeof dados.atualizadoEm !== 'string'
  ) {
    throw new ApiError('server', 'Comentário inválido recebido do servidor.');
  }

  const removido = dados.removido === true;
  if (!removido && typeof dados.texto !== 'string') {
    throw new ApiError('server', 'Comentário inválido recebido do servidor.');
  }

  return {
    id: dados.id as number,
    avaliacaoId: dados.avaliacaoId as number,
    paiId: Number.isInteger(dados.paiId) ? (dados.paiId as number) : null,
    autor: { id: autor.id as number, nome: autor.nome },
    texto: removido ? null : (dados.texto as string),
    removido,
    criadoEm: dados.criadoEm,
    atualizadoEm: dados.atualizadoEm,
    versao: dados.versao as number,
    podeEditar: !removido && dados.podeEditar === true,
    podeExcluir: !removido && dados.podeExcluir === true,
  };
}

export async function listarComentarios(
  avaliacaoId: number,
  signal?: AbortSignal,
): Promise<Comentario[]> {
  const result = await apiRequest<{ comentarios?: unknown }>(
    `/api/avaliacoes/${avaliacaoId}/comentarios`,
    { signal },
  );
  if (!Array.isArray(result?.comentarios)) {
    throw new ApiError('server', 'Resposta inválida ao carregar os comentários.');
  }
  return result.comentarios.map(comentarioFrom);
}

async function publicar(avaliacaoId: number, texto: string, paiId?: number): Promise<Comentario> {
  const result = await apiRequest<{ comentario?: unknown }>(
    `/api/avaliacoes/${avaliacaoId}/comentarios`,
    { method: 'POST', body: paiId === undefined ? { texto } : { texto, paiId } },
  );
  return comentarioFrom(result?.comentario);
}

export function comentar(avaliacaoId: number, texto: string): Promise<Comentario> {
  return publicar(avaliacaoId, texto);
}

export function responder(avaliacaoId: number, paiId: number, texto: string): Promise<Comentario> {
  return publicar(avaliacaoId, texto, paiId);
}

/** Se o comentário mudou depois da versão informada, o backend não grava: a falha é 'conflito'. */
export async function editarComentario(id: number, texto: string, versao: number): Promise<Comentario> {
  const result = await apiRequest<{ comentario?: unknown }>(`/api/comentarios/${id}`, {
    method: 'PUT',
    body: { texto, versao },
  });
  return comentarioFrom(result?.comentario);
}

export async function excluirComentario(id: number): Promise<Comentario> {
  const result = await apiRequest<{ comentario?: unknown }>(`/api/comentarios/${id}`, {
    method: 'DELETE',
  });
  return comentarioFrom(result?.comentario);
}

export function classificarFalhaComentario(falha: unknown): FalhaComentario {
  if (!(falha instanceof ApiError)) return 'servidor';
  if (falha.kind === 'auth' || falha.status === 401) return 'sessao';
  if (falha.status === 403) return 'permissao';
  // O 409 de versão antiga vem com errors.versao; os outros 409 são de comentário removido
  if (falha.status === 409 && falha.fieldErrors?.versao) return 'conflito';
  if (falha.status === 404 || falha.status === 409) return 'removido';
  if (falha.kind === 'validation') return 'validacao';
  if (falha.kind === 'network' || falha.kind === 'timeout') return 'rede';
  return 'servidor';
}
