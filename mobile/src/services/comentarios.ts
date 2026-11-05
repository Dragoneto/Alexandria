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
  podeEditar: boolean;
  podeExcluir: boolean;
};

export type FalhaComentario =
  'validacao' | 'sessao' | 'permissao' | 'removido' | 'rede' | 'servidor';

function comentarioFrom(valor: unknown): Comentario {
  const dados = (valor ?? {}) as Partial<Comentario>;
  const autor = dados.autor;
  if (
    !Number.isInteger(dados.id) ||
    !Number.isInteger(dados.avaliacaoId) ||
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

async function publicar(
  avaliacaoId: number,
  texto: string,
  paiId?: number,
  chave?: string,
): Promise<Comentario> {
  const result = await apiRequest<{ comentario?: unknown }>(
    `/api/avaliacoes/${avaliacaoId}/comentarios`,
    {
      method: 'POST',
      body: paiId === undefined ? { texto } : { texto, paiId },
      headers: chave ? { 'Idempotency-Key': chave } : undefined,
    },
  );
  return comentarioFrom(result?.comentario);
}

export function comentar(avaliacaoId: number, texto: string, chave?: string): Promise<Comentario> {
  return publicar(avaliacaoId, texto, undefined, chave);
}

export function responder(
  avaliacaoId: number,
  paiId: number,
  texto: string,
  chave?: string,
): Promise<Comentario> {
  return publicar(avaliacaoId, texto, paiId, chave);
}

export async function editarComentario(id: number, texto: string): Promise<Comentario> {
  const result = await apiRequest<{ comentario?: unknown }>(`/api/comentarios/${id}`, {
    method: 'PUT',
    body: { texto },
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
  if (falha.status === 404 || falha.status === 409) return 'removido';
  if (falha.kind === 'validation') return 'validacao';
  if (falha.kind === 'network' || falha.kind === 'timeout') return 'rede';
  return 'servidor';
}

// Chave de reenvio: a mesma em cada nova tentativa da mesma mensagem, para o backend não duplicar.
export function novaChaveDeEnvio(): string {
  const aleatorio = () => Math.random().toString(36).slice(2, 10).padEnd(8, '0');
  return `c-${Date.now().toString(36)}-${aleatorio()}${aleatorio()}`;
}

export const TEXTO_COMENTARIO_MAXIMO = 2000;
export const NIVEL_VISUAL_MAXIMO = 3;

export type ItemDaConversa = {
  comentario: Comentario;
  nivel: number;
  respondendoA: string | null;
};

// Lista plana do backend em ordem de leitura: cada resposta logo abaixo do seu pai.
export function montarConversa(lista: Comentario[]): ItemDaConversa[] {
  const porId = new Map(lista.map((comentario) => [comentario.id, comentario]));
  const filhos = new Map<number, Comentario[]>();
  const raizes: Comentario[] = [];
  for (const comentario of lista) {
    const pai = comentario.paiId === null ? undefined : porId.get(comentario.paiId);
    if (!pai || pai.id === comentario.id) {
      raizes.push(comentario);
      continue;
    }
    filhos.set(pai.id, [...(filhos.get(pai.id) ?? []), comentario]);
  }

  const saida: ItemDaConversa[] = [];
  const vistos = new Set<number>();
  const visitar = (comentario: Comentario, nivel: number, pai: Comentario | null) => {
    if (vistos.has(comentario.id)) return;
    vistos.add(comentario.id);
    const respondendoA = pai
      ? pai.removido
        ? 'comentário removido'
        : pai.autor.nome || 'Leitor'
      : null;
    saida.push({ comentario, nivel, respondendoA });
    for (const filho of filhos.get(comentario.id) ?? []) visitar(filho, nivel + 1, comentario);
  };
  raizes.forEach((raiz) => visitar(raiz, 0, null));
  return saida;
}

export function recuoVisual(nivel: number): number {
  return Math.min(Math.max(nivel, 0), NIVEL_VISUAL_MAXIMO);
}

export function mensagemDeFalhaComentario(falha: unknown): string {
  switch (classificarFalhaComentario(falha)) {
    case 'validacao':
      return falha instanceof ApiError ? falha.message : 'Confira o texto e tente de novo.';
    case 'sessao':
      return 'Sua sessão expirou. Entre de novo para continuar.';
    case 'permissao':
      return 'Você só pode alterar os seus próprios comentários.';
    case 'removido':
      return 'Esse comentário foi removido. A conversa foi atualizada.';
    case 'rede':
      return 'Sem conexão com o servidor. Seu texto continua aqui; tente de novo.';
    default:
      return 'Não foi possível concluir agora. Tente de novo em instantes.';
  }
}
