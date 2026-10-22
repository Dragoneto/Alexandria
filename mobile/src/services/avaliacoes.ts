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
