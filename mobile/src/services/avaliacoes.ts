import { apiRequest } from '@/services/api';

export const RESENHA_MINIMA = 10;
export const RESENHA_MAXIMA = 5000;

export type ErrosAvaliacao = { nota?: string; resenha?: string };

export function limparResenha(texto: string): string {
  return texto
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(/[\p{Cc}\p{Cf}]/gu, (c) => (c === '\n' || c === '\t' || c === '‍' ? c : ''))
    .replace(/‍(?!\p{Extended_Pictographic})/gu, '')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function contarCaracteres(texto: string): number {
  return [...limparResenha(texto)].length;
}

export function validarAvaliacao(nota: number | null, resenha: string): ErrosAvaliacao {
  const erros: ErrosAvaliacao = {};
  if (nota === null) erros.nota = 'Escolha uma nota de 1 a 5.';

  const texto = limparResenha(resenha);
  const tamanho = [...texto].length;
  if (!tamanho) erros.resenha = 'Escreva uma resenha sobre o livro.';
  else if (tamanho < RESENHA_MINIMA)
    erros.resenha = `A resenha precisa ter pelo menos ${RESENHA_MINIMA} caracteres.`;
  else if (tamanho > RESENHA_MAXIMA)
    erros.resenha = `A resenha pode ter no máximo ${RESENHA_MAXIMA} caracteres.`;
  else if (!/\p{L}|\p{Extended_Pictographic}/u.test(texto))
    erros.resenha = 'Escreva palavras ou emoji, não só números ou símbolos.';
  else if (new Set(texto.replace(/\s/g, '')).size === 1)
    erros.resenha = 'A resenha não pode ser só um caractere repetido.';

  return erros;
}

export type Avaliacao = {
  id: number;
  usuarioId: number;
  livro: { id: string; titulo: string; autores: string[]; capa: string | null };
  nota: number;
  resenha: string;
  criadoEm: string;
  atualizadoEm: string;
};

export async function criarAvaliacao(input: {
  livroId: string;
  nota: number | null;
  resenha: string;
}): Promise<Avaliacao> {
  const result = await apiRequest<{ avaliacao: Avaliacao }>('/api/avaliacoes', {
    method: 'POST',
    body: input,
  });
  return result.avaliacao;
}

export type AvaliacaoLida = Avaliacao & { usuarioNome: string | null; minha: boolean };

export type AvaliacoesDoLivro = {
  avaliacoes: AvaliacaoLida[];
  total: number;
  media: number | null;
  page: number;
  hasMore: boolean;
};

export async function listarAvaliacoesDoLivro(
  livroId: string,
  page = 1,
  signal?: AbortSignal,
): Promise<AvaliacoesDoLivro> {
  const result = await apiRequest<Partial<AvaliacoesDoLivro>>(
    `/api/avaliacoes/livro/${encodeURIComponent(livroId)}?page=${page}`,
    { signal },
  );
  return {
    avaliacoes: Array.isArray(result?.avaliacoes) ? result.avaliacoes : [],
    total: typeof result?.total === 'number' ? result.total : 0,
    media: typeof result?.media === 'number' ? result.media : null,
    page: typeof result?.page === 'number' ? result.page : page,
    hasMore: result?.hasMore === true,
  };
}

export async function buscarAvaliacao(id: number, signal?: AbortSignal): Promise<AvaliacaoLida> {
  const result = await apiRequest<{ avaliacao: AvaliacaoLida }>(`/api/avaliacoes/${id}`, {
    signal,
  });
  return result.avaliacao;
}

export async function atualizarAvaliacao(
  id: number,
  input: { nota: number | null; resenha: string },
): Promise<Avaliacao> {
  const result = await apiRequest<{ avaliacao: Avaliacao }>(`/api/avaliacoes/${id}`, {
    method: 'PUT',
    body: input,
  });
  return result.avaliacao;
}

// Junta a próxima página sem repetir avaliações que mudaram de posição entre as chamadas.
export function juntarAvaliacoes(atuais: AvaliacaoLida[], novas: AvaliacaoLida[]): AvaliacaoLida[] {
  const vistas = new Set(atuais.map((avaliacao) => avaliacao.id));
  return [...atuais, ...novas.filter((avaliacao) => !vistas.has(avaliacao.id))];
}

export function formatarMedia(media: number | null): string {
  return media === null ? '' : media.toFixed(1).replace('.', ',');
}

export function resumoAvaliacoes(total: number, media: number | null): string {
  if (!total || media === null) return 'Nenhuma avaliação ainda';
  const quantidade = total === 1 ? '1 avaliação' : `${total} avaliações`;
  return `Média ${formatarMedia(media)} de 5 · ${quantidade}`;
}

export function estrelas(nota: number): string {
  const cheias = Math.min(5, Math.max(0, Math.round(nota)));
  return '★'.repeat(cheias) + '☆'.repeat(5 - cheias);
}

export async function listarMinhasAvaliacoes(signal?: AbortSignal): Promise<AvaliacaoLida[]> {
  const result = await apiRequest<{ avaliacoes?: AvaliacaoLida[] }>('/api/avaliacoes/minhas', {
    signal,
  });
  return Array.isArray(result?.avaliacoes) ? result.avaliacoes : [];
}

export async function excluirAvaliacao(id: number): Promise<void> {
  await apiRequest(`/api/avaliacoes/${id}`, { method: 'DELETE' });
}
