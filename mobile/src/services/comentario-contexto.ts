import { ApiError, apiRequest } from '@/services/api';
import { comentarioFrom, type Comentario } from '@/services/comentarios';

export type DestinoComentario = { avaliacaoId: number; comentarioId: number; eventoId?: string };
export type ContextoComentario = DestinoComentario & {
  livroId: string;
  alvo: Comentario;
  ancestrais: Comentario[];
  comentarios: Comentario[];
  proximoCursor: number | null;
  ancestralAnteriorId: number | null;
};
const ID = /^[1-9]\d{0,8}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function validarDestino(
  avaliacao: unknown,
  comentario: unknown,
  evento?: unknown,
): DestinoComentario {
  if (
    !['string', 'number'].includes(typeof avaliacao) ||
    !ID.test(String(avaliacao)) ||
    !['string', 'number'].includes(typeof comentario) ||
    !ID.test(String(comentario)) ||
    (evento !== undefined && (typeof evento !== 'string' || !UUID.test(evento)))
  ) {
    throw new ApiError('validation', 'Link de comentário inválido.');
  }
  return {
    avaliacaoId: Number(avaliacao),
    comentarioId: Number(comentario),
    eventoId: evento as string | undefined,
  };
}

export function destinoDaNotificacao(item: DestinoComentario & { alvoDisponivel: boolean }) {
  if (!item.alvoDisponivel || !item.eventoId)
    throw new ApiError('validation', 'Este comentário não está mais disponível.');
  const destino = validarDestino(item.avaliacaoId, item.comentarioId, item.eventoId);
  return {
    pathname: '/comentario/[id]' as const,
    params: {
      id: String(destino.comentarioId),
      avaliacaoId: String(destino.avaliacaoId),
      eventoId: destino.eventoId,
    },
  };
}

export async function buscarContexto(
  destino: DestinoComentario,
  signal?: AbortSignal,
  apos?: number,
): Promise<ContextoComentario> {
  validarDestino(destino.avaliacaoId, destino.comentarioId, destino.eventoId);
  if (apos !== undefined && (!Number.isInteger(apos) || apos < destino.comentarioId))
    throw new ApiError('validation', 'Página inválida.');
  const query = new URLSearchParams();
  if (destino.eventoId) query.set('eventoId', destino.eventoId);
  if (apos !== undefined) query.set('apos', String(apos));
  const data = await apiRequest<ContextoComentario>(
    `/api/avaliacoes/${destino.avaliacaoId}/comentarios/${destino.comentarioId}/contexto?${query}`,
    { signal },
  );
  const nextId = (id: unknown) => id === null || (Number.isInteger(id) && Number(id) > 0);
  if (
    !data ||
    data.avaliacaoId !== destino.avaliacaoId ||
    data.comentarioId !== destino.comentarioId ||
    typeof data.livroId !== 'string' ||
    !/^OL\d+W$/.test(data.livroId) ||
    !Array.isArray(data.ancestrais) ||
    data.ancestrais.length > 50 ||
    !Array.isArray(data.comentarios) ||
    data.comentarios.length > 20 ||
    !nextId(data.proximoCursor) ||
    !nextId(data.ancestralAnteriorId) ||
    (data.proximoCursor !== null && data.proximoCursor <= (apos ?? destino.comentarioId - 1))
  ) {
    throw new ApiError('server', 'Contexto inválido recebido do servidor.');
  }
  const parse = (value: unknown) => {
    const item = comentarioFrom(value);
    if (item.avaliacaoId !== destino.avaliacaoId)
      throw new ApiError('server', 'Comentário de outra avaliação.');
    return item;
  };
  const alvo = parse(data.alvo);
  if (alvo.id !== destino.comentarioId || alvo.removido)
    throw new ApiError('server', 'Alvo inválido.');
  return {
    ...data,
    alvo,
    ancestrais: data.ancestrais.map(parse),
    comentarios: data.comentarios.map(parse),
  };
}
