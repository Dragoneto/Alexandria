const OPEN_LIBRARY_URL = 'https://openlibrary.org';
const COVER_URL = 'https://covers.openlibrary.org';
const DEFAULT_TIMEOUT_MS = 10000;
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

export type OpenLibraryErrorKind = 'validation' | 'network' | 'timeout' | 'server';

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

type SearchDocument = {
  key?: unknown;
  title?: unknown;
  author_name?: unknown;
  cover_i?: unknown;
  first_publish_year?: unknown;
  edition_count?: unknown;
  language?: unknown;
};

type SearchResponse = {
  numFound?: unknown;
  num_found?: unknown;
  docs?: unknown;
};

const CATEGORY_SUBJECTS: Record<string, string> = {
  Fantasia: 'fantasy',
  Romance: 'romance',
  História: 'history',
  Tecnologia: 'technology',
  Biografia: 'biography',
  Mistério: 'mystery',
};

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function positiveInteger(value: unknown, fallback: number): number {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : fallback;
}

function normalizeKey(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\/?works\/OL\d+W$/.test(value)) return null;
  return value.startsWith('/') ? value : `/${value}`;
}

function mapDocument(value: unknown, selectedCategory?: string): BookSearchItem | null {
  if (!value || typeof value !== 'object') return null;
  const document = value as SearchDocument;
  const key = normalizeKey(document.key);
  if (!key || typeof document.title !== 'string' || !document.title.trim()) return null;

  const coverId = positiveInteger(document.cover_i, 0);
  return {
    id: key.slice('/works/'.length),
    title: document.title.trim(),
    authors: stringArray(document.author_name).slice(0, 3),
    category: selectedCategory ?? 'Catálogo geral',
    coverUrl: coverId ? `${COVER_URL}/b/id/${coverId}-M.jpg?default=false` : null,
    firstPublishYear: positiveInteger(document.first_publish_year, 0) || null,
    editionCount: positiveInteger(document.edition_count, 1),
    languages: stringArray(document.language).slice(0, 5),
    openLibraryUrl: `${OPEN_LIBRARY_URL}${key}`,
  };
}

function createCombinedSignal(externalSignal: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromExternal = () => controller.abort(externalSignal?.reason);
  externalSignal?.addEventListener('abort', abortFromExternal, { once: true });
  if (externalSignal?.aborted) abortFromExternal();
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    dispose: () => {
      clearTimeout(timer);
      externalSignal?.removeEventListener('abort', abortFromExternal);
    },
  };
}

export async function searchBooks(options: BookSearchOptions): Promise<BookSearchResult> {
  const query = options.query.trim();
  if (query.length < 2) {
    throw new OpenLibraryError('validation', 'Digite pelo menos dois caracteres para buscar.');
  }

  const page = positiveInteger(options.page, 1);
  const limit = Math.min(positiveInteger(options.limit, 10), MAX_RESULTS_PER_PAGE);
  const quality = options.quality ?? 'precise';
  const categorySubject = options.category ? CATEGORY_SUBJECTS[options.category] : undefined;
  const searchTerms = [query, categorySubject ? `subject:${categorySubject}` : null]
    .filter(Boolean)
    .join(' ');
  const parameters = new URLSearchParams({
    q: searchTerms,
    fields: 'key,title,author_name,cover_i,first_publish_year,edition_count,language',
    lang: 'pt',
    page: String(page),
    limit: String(limit),
  });
  if (options.order === 'newest') parameters.set('sort', 'new');

  const request = createCombinedSignal(options.signal, DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(`${OPEN_LIBRARY_URL}/search.json?${parameters}`, {
      headers: { Accept: 'application/json' },
      signal: request.signal,
    });
    if (!response.ok) {
      throw new OpenLibraryError(
        'server',
        `A Open Library não conseguiu concluir a busca (HTTP ${response.status}).`,
        response.status,
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new OpenLibraryError('server', 'A Open Library retornou uma resposta inválida.');
    }
    if (
      !payload ||
      typeof payload !== 'object' ||
      !Array.isArray((payload as SearchResponse).docs)
    ) {
      throw new OpenLibraryError('server', 'A Open Library retornou uma resposta inválida.');
    }
    const searchResponse = payload as SearchResponse & { docs: unknown[] };
    const mapped = searchResponse.docs
      .map((document) => mapDocument(document, options.category))
      .filter((book): book is BookSearchItem => !!book);
    const books =
      quality === 'curated'
        ? mapped.filter((book) => book.coverUrl && book.authors.length > 0)
        : mapped;
    const totalValue = searchResponse.numFound ?? searchResponse.num_found;
    const total =
      typeof totalValue === 'number' && Number.isSafeInteger(totalValue) && totalValue >= 0
        ? totalValue
        : books.length;

    return {
      books,
      total,
      page,
      limit,
      hasMore: page * limit < total,
    };
  } catch (error) {
    if (error instanceof OpenLibraryError) throw error;
    if (request.timedOut()) {
      throw new OpenLibraryError(
        'timeout',
        'A Open Library demorou para responder. Tente novamente.',
      );
    }
    if (options.signal?.aborted) throw error;
    throw new OpenLibraryError('network', 'Não foi possível conectar à Open Library.');
  } finally {
    request.dispose();
  }
}
