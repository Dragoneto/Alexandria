import { apiRequest } from '@/services/api';

export type StatusLeitura = 'QUERO_LER' | 'LENDO' | 'LIDO' | 'ABANDONADO';

/** Tracker de leitura: páginas e dias em que a pessoa abriu o app com o livro em "Lendo". */
export type Progresso = {
  paginaAtual: number;
  paginasTotal: number | null;
  diasLeitura: number;
  concluidoEm: string | null;
};

export type BibliotecaItem = {
  id: number;
  statusLeitura: StatusLeitura;
  favorito: boolean;
  livro: { id: string; titulo: string; autores: string[]; capa: string | null };
  /** Ausente em respostas de versões antigas do backend. */
  progresso?: Progresso;
};

export type ResumoDeLeitura = {
  lidos: number;
  lendo: number;
  paginasLidas: number;
  diasLeitura: number;
};

/** Totais do perfil: livro lido conta inteiro; os outros, até a página em que a pessoa parou. */
export function resumoDeLeitura(itens: BibliotecaItem[]): ResumoDeLeitura {
  return itens.reduce<ResumoDeLeitura>(
    (resumo, item) => {
      const progresso = item.progresso;
      const paginas =
        item.statusLeitura === 'LIDO'
          ? (progresso?.paginasTotal ?? progresso?.paginaAtual ?? 0)
          : (progresso?.paginaAtual ?? 0);
      return {
        lidos: resumo.lidos + (item.statusLeitura === 'LIDO' ? 1 : 0),
        lendo: resumo.lendo + (item.statusLeitura === 'LENDO' ? 1 : 0),
        paginasLidas: resumo.paginasLidas + paginas,
        // Dois livros lidos no mesmo dia são um dia só: sem o total do servidor, vale o maior.
        diasLeitura: Math.max(resumo.diasLeitura, progresso?.diasLeitura ?? 0),
      };
    },
    { lidos: 0, lendo: 0, paginasLidas: 0, diasLeitura: 0 },
  );
}

/** Porcentagem lida (0 a 100), ou null quando o livro não tem o número de páginas. */
export function porcentagemLida(progresso: Progresso | undefined): number | null {
  if (!progresso?.paginasTotal) return null;
  return Math.min(100, Math.round((progresso.paginaAtual / progresso.paginasTotal) * 100));
}

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
  atualizacao: {
    status?: StatusLeitura;
    favorito?: boolean;
    paginaAtual?: number;
    paginasTotal?: number;
  },
): Promise<BibliotecaItem> {
  const result = await apiRequest<{ item: BibliotecaItem }>(`/api/biblioteca/${id}`, {
    method: 'PATCH',
    body: atualizacao,
  });
  return result.item;
}

/** Conta o dia de hoje para os livros em "Lendo" (o backend ignora se o dia já contou). */
export async function registrarDiaDeLeitura(): Promise<void> {
  await apiRequest('/api/biblioteca/dia-de-leitura', { method: 'POST' });
}

/** Dias distintos com algum livro em "Lendo"; null quando o servidor não informa. */
export async function buscarDiasDeLeitura(signal?: AbortSignal): Promise<number | null> {
  const result = await apiRequest<{ diasLeitura?: number }>('/api/biblioteca/dias-de-leitura', {
    signal,
  });
  return typeof result?.diasLeitura === 'number' ? result.diasLeitura : null;
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

// Coloca o livro como LIDO: atualiza o item se ele já estiver na biblioteca, senão adiciona.
export async function marcarComoLido(
  livroId: string,
  signal?: AbortSignal,
): Promise<BibliotecaItem> {
  const existente = encontrarItemDoLivro(await listarBiblioteca(signal), livroId);
  if (!existente) return adicionarNaBiblioteca(livroId, 'LIDO');
  if (existente.statusLeitura === 'LIDO') return existente;
  return atualizarItemBiblioteca(existente.id, { status: 'LIDO' });
}

// Diz se o livro já está na biblioteca, com qualquer status (a sugestão de marcar como lido só
// aparece para livros que ainda não estão lá).
export async function livroEstaNaBiblioteca(
  livroId: string,
  signal?: AbortSignal,
): Promise<boolean> {
  return encontrarItemDoLivro(await listarBiblioteca(signal), livroId) !== null;
}
