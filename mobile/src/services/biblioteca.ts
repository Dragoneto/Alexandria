import { apiRequest } from '@/services/api';

export type StatusLeitura = 'QUERO_LER' | 'LENDO' | 'LIDO' | 'ABANDONADO';

export type BibliotecaItem = {
  id: number;
  statusLeitura: StatusLeitura;
  favorito: boolean;
  livro: { id: string; titulo: string; autores: string[]; capa: string | null };
};

export type FiltroBiblioteca = {
  status?: StatusLeitura | null;
  somenteFavoritos?: boolean;
  busca?: string;
};

// Ignora maiúsculas, acentos e espaços repetidos.
export function normalizarBusca(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Filtra a lista já carregada; busca, status e favoritos se combinam.
export function filtrarBiblioteca(
  itens: BibliotecaItem[],
  { status, somenteFavoritos = false, busca = '' }: FiltroBiblioteca = {},
): BibliotecaItem[] {
  const termo = normalizarBusca(busca);
  return itens.filter(
    (item) =>
      (!status || item.statusLeitura === status) &&
      (!somenteFavoritos || item.favorito) &&
      (!termo ||
        normalizarBusca([item.livro.titulo, ...item.livro.autores].join(' ')).includes(termo)),
  );
}

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

export function encontrarItemDoLivro(
  itens: BibliotecaItem[],
  livroId: string,
): BibliotecaItem | null {
  return itens.find((item) => item.livro?.id === livroId) ?? null;
}

// Uma ação por livro de cada vez; um segundo toque durante o envio é ignorado (devolve false).
export async function comTrava(
  pendentes: Set<string>,
  chave: string,
  acao: () => Promise<void>,
): Promise<boolean> {
  if (pendentes.has(chave)) return false;
  pendentes.add(chave);
  try {
    await acao();
    return true;
  } finally {
    pendentes.delete(chave);
  }
}

// Mostra o status novo na hora e, se a API falhar, volta ao anterior antes de repassar o erro.
export async function trocarStatusOtimista(
  item: BibliotecaItem,
  status: StatusLeitura,
  aplicar: (item: BibliotecaItem) => void,
): Promise<void> {
  if (item.statusLeitura === status) return;
  aplicar({ ...item, statusLeitura: status });
  try {
    const salvo = await atualizarItemBiblioteca(item.id, { status });
    aplicar(salvo?.id === item.id ? salvo : { ...item, statusLeitura: status });
  } catch (error) {
    aplicar(item);
    throw error;
  }
}
