const { mapSearchDocuments, mapWorkDetail } = require('../services/bookMapper');
const openLibrary = require('../services/openLibrary');

const TERMO_MINIMO = 2;
const LIMITE_PADRAO = 10;
const LIMITE_MAXIMO = 20;
const ID_OBRA = /^OL\d+W$/;
// Categorias do app e o assunto equivalente na Open Library
const CATEGORY_SUBJECTS = new Map([
  ['Fantasia', 'fantasy'],
  ['Romance', 'romance'],
  ['História', 'history'],
  ['Tecnologia', 'technology'],
  ['Biografia', 'biography'],
  ['Mistério', 'mystery'],
]);
const STATUS_POR_FALHA = { timeout: 504, unavailable: 502, invalid: 502, not_found: 404 };

function textParam(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// Ausente usa o padrão; presente e fora do formato retorna null
function positiveIntParam(value, fallback) {
  if (value === undefined) return fallback;
  const number = typeof value === 'string' && /^\d{1,6}$/.test(value.trim()) ? Number(value) : 0;
  return number > 0 ? number : null;
}

function responderFalha(res, error, contexto) {
  if (error instanceof openLibrary.OpenLibraryError) {
    return res.status(STATUS_POR_FALHA[error.kind] ?? 502).json({ error: error.message });
  }
  console.error(`${contexto}:`, error.message);
  return res.status(500).json({ error: 'Erro interno do servidor' });
}

// ==========================================
// BUSCA - GET /api/books/search?q=&category=&order=&page=&limit=
// ==========================================
const search = async (req, res) => {
  try {
    const query = textParam(req.query?.q);
    if (query.length < TERMO_MINIMO) {
      return res.status(400).json({ error: 'Digite pelo menos dois caracteres para buscar.' });
    }

    const category = textParam(req.query?.category);
    if (category && !CATEGORY_SUBJECTS.has(category)) {
      return res.status(400).json({ error: 'Categoria inválida' });
    }

    const page = positiveIntParam(req.query?.page, 1);
    const requestedLimit = positiveIntParam(req.query?.limit, LIMITE_PADRAO);
    if (!page || !requestedLimit) {
      return res.status(400).json({ error: 'Página e tamanho devem ser números inteiros positivos' });
    }
    const limit = Math.min(requestedLimit, LIMITE_MAXIMO);

    // A Open Library já pagina: página e tamanho seguem direto para ela
    const { docs, total } = await openLibrary.searchWorks({
      query,
      subject: CATEGORY_SUBJECTS.get(category),
      sort: req.query?.order === 'newest' ? 'new' : undefined,
      page,
      limit,
    });

    return res.json({
      books: mapSearchDocuments(docs, category || undefined),
      total,
      page,
      limit,
      hasMore: page * limit < total,
    });
  } catch (error) {
    return responderFalha(res, error, 'Erro na busca de livros');
  }
};

// ==========================================
// DETALHE - GET /api/books/:id
// ==========================================
const detail = async (req, res) => {
  try {
    const id = textParam(req.params?.id);
    if (!ID_OBRA.test(id)) {
      return res.status(400).json({ error: 'Identificador de livro inválido' });
    }

    const work = await openLibrary.getWork(id);
    const book = mapWorkDetail(work, await openLibrary.getAuthorNames(work));
    if (!book) {
      return res.status(404).json({ error: 'Livro não encontrado na Open Library.' });
    }

    return res.json({ book });
  } catch (error) {
    return responderFalha(res, error, 'Erro no detalhe do livro');
  }
};

module.exports = { search, detail };
