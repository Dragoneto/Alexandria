// Cliente da Open Library usado pelas rotas de livros (#29).
// Devolve os dados brutos; a conversão para o formato da API fica em bookMapper.

const { SEARCH_FIELDS } = require('./bookMapper');

const OPEN_LIBRARY_URL = 'https://openlibrary.org';
const USER_AGENT = 'Alexandria/1.0 (projeto academico)';
// Menor que o timeout do app (15s), para o erro chegar com mensagem própria
const TIMEOUT_MS = 8000;
const AUTHOR_TIMEOUT_MS = 4000;
const MAX_AUTHORS = 3;

class OpenLibraryError extends Error {
  /** @param {'timeout'|'unavailable'|'invalid'|'not_found'} kind */
  constructor(kind, message, status) {
    super(message);
    this.name = 'OpenLibraryError';
    this.kind = kind;
    this.status = status;
  }
}

function timeoutError() {
  return new OpenLibraryError('timeout', 'A Open Library demorou para responder.');
}

async function getJson(path, timeoutMs = TIMEOUT_MS) {
  let response;
  try {
    response = await fetch(`${OPEN_LIBRARY_URL}${path}`, {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error?.name === 'TimeoutError') throw timeoutError();
    throw new OpenLibraryError('unavailable', 'Não foi possível conectar à Open Library.');
  }

  if (!response.ok) {
    throw new OpenLibraryError(
      'unavailable',
      `A Open Library não conseguiu responder (HTTP ${response.status}).`,
      response.status,
    );
  }

  try {
    return await response.json();
  } catch (error) {
    if (error?.name === 'TimeoutError') throw timeoutError();
    throw new OpenLibraryError('invalid', 'A Open Library retornou uma resposta inválida.');
  }
}

/**
 * Busca obras em /search.json e devolve os documentos como vieram.
 *
 * @param {object} options
 * @param {string} options.query      termo já validado
 * @param {string} [options.subject]  assunto da Open Library (ex.: fantasy)
 * @param {string} [options.sort]     ordenação da Open Library (ex.: new)
 * @param {number} options.page       página, a partir de 1
 * @param {number} options.limit      resultados por página
 * @returns {Promise<{ docs: unknown[], total: number }>}
 */
async function searchWorks({ query, subject, sort, page, limit }) {
  const parameters = new URLSearchParams({
    q: subject ? `${query} subject:${subject}` : query,
    fields: SEARCH_FIELDS,
    lang: 'pt',
    page: String(page),
    limit: String(limit),
  });
  if (sort) parameters.set('sort', sort);

  const payload = await getJson(`/search.json?${parameters}`);
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.docs)) {
    throw new OpenLibraryError('invalid', 'A Open Library retornou uma resposta inválida.');
  }

  const total = payload.numFound ?? payload.num_found;
  return {
    docs: payload.docs,
    total: Number.isSafeInteger(total) && total >= 0 ? total : payload.docs.length,
  };
}

async function getWorkJson(id) {
  try {
    return await getJson(`/works/${id}.json`);
  } catch (error) {
    if (error.status === 404) {
      throw new OpenLibraryError('not_found', 'Livro não encontrado na Open Library.', 404);
    }
    throw error;
  }
}

/**
 * Lê a obra em /works/{id}.json como veio. Obras unificadas respondem com um
 * redirecionamento para a obra que ficou; nesse caso devolve a obra de destino.
 *
 * @param {string} id  identificador já validado (ex.: OL27448W)
 */
async function getWork(id) {
  const work = await getWorkJson(id);
  const target =
    work?.type?.key === '/type/redirect' && typeof work.location === 'string'
      ? /^\/works\/(OL\d+W)$/.exec(work.location)?.[1]
      : null;
  return target && target !== id ? getWorkJson(target) : work;
}

function authorKeys(work) {
  if (!Array.isArray(work?.authors)) return [];
  const keys = work.authors
    .map((entry) => (typeof entry?.author === 'string' ? entry.author : entry?.author?.key))
    .filter((key) => typeof key === 'string' && /^\/authors\/OL\d+A$/.test(key));
  return [...new Set(keys)].slice(0, MAX_AUTHORS);
}

/** Nomes dos autores da obra. Autor que falhar fica de fora, sem derrubar o detalhe. */
async function getAuthorNames(work) {
  const names = await Promise.all(
    authorKeys(work).map(async (key) => {
      try {
        const author = await getJson(`${key}.json`, AUTHOR_TIMEOUT_MS);
        return typeof author?.name === 'string' ? author.name.trim() : '';
      } catch {
        return '';
      }
    }),
  );
  return names.filter(Boolean);
}

module.exports = { OpenLibraryError, searchWorks, getWork, getAuthorNames };
