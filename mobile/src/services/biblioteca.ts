import { apiRequest } from '@/services/api';

export type StatusLeitura = 'QUERO_LER' | 'LENDO' | 'LIDO' | 'ABANDONADO';

export type BibliotecaItem = {
  id: number;
  statusLeitura: StatusLeitura;
  favorito: boolean;
  livro: { id: string; titulo: string; autores: string[]; capa: string | null };
};

export async function listarBiblioteca(
  signal?: AbortSignal,
  status?: StatusLeitura,
): Promise<BibliotecaItem[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  const result = await apiRequest<{ itens?: BibliotecaItem[] }>(`/api/biblioteca${query}`, {
    signal,
  });
  return Array.isArray(result?.itens) ? result.itens : [];
}

export async function adicionarNaBiblioteca(
  livroId: string,
  status: StatusLeitura = 'QUERO_LER',
): Promise<BibliotecaItem> {
  const result = await apiRequest<{ item: BibliotecaItem }>('/api/biblioteca', {
    method: 'POST',
    body: { livroId, status },
  });
  return result.item;
}

export async function atualizarItemBiblioteca(
  id: number,
  atualizacao: { status?: StatusLeitura; favorito?: boolean },
): Promise<BibliotecaItem> {
  const result = await apiRequest<{ item: BibliotecaItem }>(`/api/biblioteca/${id}`, {
    method: 'PATCH',
    body: atualizacao,
  });
  return result.item;
}

export async function removerDaBiblioteca(id: number): Promise<void> {
  await apiRequest(`/api/biblioteca/${id}`, { method: 'DELETE' });
}
