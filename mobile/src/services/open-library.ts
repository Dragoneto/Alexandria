import { ApiError, apiRequest } from '@/services/api';

const SEARCH_PATH = '/api/books/search';
const BOOK_ID = /^OL\d+W$/;
const MAX_RESULTS_PER_PAGE = 20;

export type BookSearchOrder = 'relevance' | 'newest';
export type BookSearchQuality = 'precise' | 'curated' | 'all';

export type BookSearchOptions = {
  query: string;
  category?: string;
  order?: BookSearchOrder;
  quality?: BookSearchQuality;
  page?: number;
  limit?: number;
  signal?: AbortSignal;
};

export type BookSearchItem = {
  id: string;
  title: string;
  authors: string[];
  category: string;
  coverUrl: string | null;
  firstPublishYear: number | null;
  editionCount: number;
  languages: string[];
  openLibraryUrl: string;
};

export type BookSearchResult = {
  books: BookSearchItem[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
};

export type BookDetail = {
  id: string;
  title: string;
  authors: string[];
  /** Sinopse; muitos livros da Open Library não têm. */
  description: string | null;
  categories: string[];
  coverUrl: string | null;
  openLibraryUrl: string;
};

export type OpenLibraryErrorKind = 'validation' | 'network' | 'timeout' | 'server' | 'notFound';

export class OpenLibraryError extends Error {
  constructor(
    public kind: OpenLibraryErrorKind,
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'OpenLibraryError';
  }
}

export type SearchErrorView = { title: string; message: string };

const SEARCH_ERROR_VIEWS: Partial<Record<OpenLibraryErrorKind, SearchErrorView>> = {
  network: {
    title: 'Não foi possível conectar',
    message: 'Confira sua conexão com a internet e tente de novo.',
  },
  timeout: {
    title: 'A busca demorou demais',
    message: 'A Open Library está demorando para responder. Tente de novo em instantes.',
  },
  server: {
    title: 'A Open Library não respondeu',
    message: 'O serviço de livros está instável agora. Tente de novo em alguns minutos.',
  },
};

const GENERIC_SEARCH_ERROR: SearchErrorView = {
  title: 'Não foi possível buscar livros',
  message: 'Tente de novo em instantes.',
};

/** Texto da falha para a tela. Termo inválido não passa por aqui: é erro do campo de busca. */
export function describeSearchError(error: unknown): SearchErrorView {
  if (error instanceof OpenLibraryError) {
    return SEARCH_ERROR_VIEWS[error.kind] ?? GENERIC_SEARCH_ERROR;
  }
  return GENERIC_SEARCH_ERROR;
}

function positiveInteger(value: unknown, fallback: number): number {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

// As telas leem estes campos sem conferir; item fora do formato fica de fora
function isBookItem(value: unknown): value is BookSearchItem {
  if (!value || typeof value !== 'object') return false;
  const book = value as Partial<BookSearchItem>;
  return (
    typeof book.id === 'string' && typeof book.title === 'string' && Array.isArray(book.authors)
  );
}

// Falhas que a tela sabe explicar viram OpenLibraryError; sessão e configuração seguem como vieram
function toBookError(error: unknown): unknown {
  if (!(error instanceof ApiError)) return error;
  if (error.kind === 'validation' || error.kind === 'network') {
    return new OpenLibraryError(error.kind, error.message, error.status);
  }
  if (error.kind === 'timeout' || error.status === 504) {
    return new OpenLibraryError('timeout', error.message, error.status);
  }
  if (error.kind === 'server') return new OpenLibraryError('server', error.message, error.status);
  return error;
}

export async function searchBooks(options: BookSearchOptions): Promise<BookSearchResult> {
  const query = options.query.trim();
  if (query.length < 2) {
    throw new OpenLibraryError('validation', 'Digite pelo menos dois caracteres para buscar.');
  }

  const page = positiveInteger(options.page, 1);
  const limit = Math.min(positiveInteger(options.limit, 10), MAX_RESULTS_PER_PAGE);
  const parameters = new URLSearchParams({ q: query, page: String(page), limit: String(limit) });
  if (options.category) parameters.set('category', options.category);
  if (options.order === 'newest') parameters.set('order', 'newest');

  let result: BookSearchResult;
  try {
    result = await apiRequest<BookSearchResult>(`${SEARCH_PATH}?${parameters}`, {
      signal: options.signal,
    });
  } catch (error) {
    throw toBookError(error);
  }
  if (!result || !Array.isArray(result.books)) {
    throw new OpenLibraryError('server', 'O servidor retornou uma resposta inválida.');
  }

  const valid = result.books.filter(isBookItem);
  const books =
    options.quality === 'curated'
      ? valid.filter((book) => book.coverUrl && book.authors.length > 0)
      : valid;
  return {
    books,
    total: Number.isSafeInteger(result.total) && result.total >= 0 ? result.total : books.length,
    page,
    limit,
    hasMore: result.hasMore === true,
  };
}

export async function getBookDetail(id: string, signal?: AbortSignal): Promise<BookDetail> {
  if (!BOOK_ID.test(id)) throw new OpenLibraryError('notFound', 'Livro não encontrado.');

  let result: { book?: Partial<BookDetail> };
  try {
    result = await apiRequest<{ book?: Partial<BookDetail> }>(`/api/books/${id}`, { signal });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      throw new OpenLibraryError('notFound', error.message, 404);
    }
    throw toBookError(error);
  }
  const book = result?.book;
  if (!book || typeof book.id !== 'string' || typeof book.title !== 'string') {
    throw new OpenLibraryError('server', 'O servidor retornou uma resposta inválida.');
  }
  return {
    id: book.id,
    title: book.title,
    authors: stringArray(book.authors),
    description:
      typeof book.description === 'string' && book.description.trim() ? book.description : null,
    categories: stringArray(book.categories),
    coverUrl: typeof book.coverUrl === 'string' ? book.coverUrl : null,
    openLibraryUrl:
      typeof book.openLibraryUrl === 'string'
        ? book.openLibraryUrl
        : `https://openlibrary.org/works/${book.id}`,
  };
}
