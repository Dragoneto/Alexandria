import { apiRequest } from '@/services/api';

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
