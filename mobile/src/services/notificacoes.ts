import { ApiError, apiRequest } from '@/services/api';
import { destinoDaNotificacao } from '@/services/comentario-contexto';

export type Notificacao = {
  id: string;
  tipo: 'comentario' | 'resposta';
  autor: { id: number; nome: string };
  avaliacaoId: number;
  comentarioId: number;
  eventoId: string;
  criadoEm: string;
  lidaEm: string | null;
  alvoDisponivel: boolean;
  /** Título do livro da avaliação; servidores antigos não mandam. */
  livroTitulo?: string | null;
};
export type PaginaNotificacoes = { notificacoes: Notificacao[]; proximoCursor: string | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function parseItem(value: unknown): Notificacao {
  const item = value as Partial<Notificacao> | null;
  if (
    !item ||
    !UUID.test(item.id ?? '') ||
    !['comentario', 'resposta'].includes(item.tipo ?? '') ||
    !Number.isInteger(item.autor?.id) ||
    !item.autor?.nome ||
    !Number.isInteger(item.avaliacaoId) ||
    !Number.isInteger(item.comentarioId) ||
    !UUID.test(item.eventoId ?? '') ||
    typeof item.criadoEm !== 'string' ||
    !Number.isFinite(Date.parse(item.criadoEm)) ||
    !(
      item.lidaEm === null ||
      (typeof item.lidaEm === 'string' && Number.isFinite(Date.parse(item.lidaEm)))
    ) ||
    typeof item.alvoDisponivel !== 'boolean'
  ) {
    throw new ApiError('server', 'Notificação inválida recebida do servidor.');
  }
  const livroTitulo =
    typeof item.livroTitulo === 'string' && item.livroTitulo.trim()
      ? item.livroTitulo.trim()
      : null;
  return { ...(item as Notificacao), livroTitulo };
}

/** O que aconteceu, dito para quem recebe: "comentou na sua avaliação de Dom Casmurro". */
export function textoDaNotificacao(item: Pick<Notificacao, 'tipo' | 'livroTitulo'>): string {
  const base =
    item.tipo === 'resposta' ? 'respondeu ao seu comentário' : 'comentou na sua avaliação';
  if (!item.livroTitulo) return base;
  return `${base} ${item.tipo === 'resposta' ? 'em' : 'de'} ${item.livroTitulo}`;
}

export async function listarNotificacoes(
  cursor?: string,
  signal?: AbortSignal,
): Promise<PaginaNotificacoes> {
  const query = new URLSearchParams({ limit: '20' });
  if (cursor) query.set('cursor', cursor);
  const result = await apiRequest<{ notificacoes?: unknown; proximoCursor?: unknown }>(
    `/api/notificacoes?${query}`,
    { signal },
  );
  if (
    !Array.isArray(result?.notificacoes) ||
    !(result.proximoCursor === null || typeof result.proximoCursor === 'string')
  ) {
    throw new ApiError('server', 'Resposta inválida ao carregar notificações.');
  }
  return { notificacoes: result.notificacoes.map(parseItem), proximoCursor: result.proximoCursor };
}

export async function contarNaoLidas(signal?: AbortSignal): Promise<number> {
  const result = await apiRequest<{ total?: unknown }>('/api/notificacoes/nao-lidas', { signal });
  if (!Number.isInteger(result?.total) || Number(result.total) < 0)
    throw new ApiError('server', 'Contador inválido.');
  return Number(result.total);
}

export async function marcarNotificacaoLida(id: string): Promise<void> {
  if (!UUID.test(id)) throw new ApiError('validation', 'Notificação inválida.');
  await apiRequest(`/api/notificacoes/${id}/lida`, { method: 'PATCH' });
}

export async function marcarTodasNotificacoesLidas(): Promise<void> {
  await apiRequest('/api/notificacoes/lidas', { method: 'PATCH' });
}

export function destinoDaNotificacaoRecebida(item: Notificacao) {
  return destinoDaNotificacao(item);
}
