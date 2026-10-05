// Cliente da Open Library usado pelas rotas de livros (#29).
// Devolve os dados brutos; a conversão para o formato da API fica em bookMapper.

const { SEARCH_FIELDS } = require('./bookMapper');

const OPEN_LIBRARY_URL = 'https://openlibrary.org';
const USER_AGENT = 'Alexandria/1.0 (projeto academico)';
// Menor que o timeout do app (15s), para o erro chegar com mensagem própria
const TIMEOUT_MS = 8000;
const SEARCH_LIMIT = 10;

class OpenLibraryError extends Error {
  /** @param {'timeout'|'unavailable'|'invalid'} kind */
  constructor(kind, message) {
    super(message);
    this.name = 'OpenLibraryError';
    this.kind = kind;
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
 * @returns {Promise<{ docs: unknown[], total: number }>}
 */
async function searchWorks({ query, subject, sort }) {
  const parameters = new URLSearchParams({
    q: subject ? `${query} subject:${subject}` : query,
    fields: SEARCH_FIELDS,
    lang: 'pt',
    limit: String(SEARCH_LIMIT),
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

module.exports = { OpenLibraryError, searchWorks };
