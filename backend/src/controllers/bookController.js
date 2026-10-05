const { mapSearchDocuments } = require('../services/bookMapper');
const openLibrary = require('../services/openLibrary');

const TERMO_MINIMO = 2;
// Categorias do app e o assunto equivalente na Open Library
const CATEGORY_SUBJECTS = new Map([
  ['Fantasia', 'fantasy'],
  ['Romance', 'romance'],
  ['História', 'history'],
  ['Tecnologia', 'technology'],
  ['Biografia', 'biography'],
  ['Mistério', 'mystery'],
]);
const STATUS_POR_FALHA = { timeout: 504, unavailable: 502, invalid: 502 };

function textParam(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function responderFalha(res, error, contexto) {
  if (error instanceof openLibrary.OpenLibraryError) {
    return res.status(STATUS_POR_FALHA[error.kind] ?? 502).json({ error: error.message });
  }
  console.error(`${contexto}:`, error.message);
  return res.status(500).json({ error: 'Erro interno do servidor' });
}

// ==========================================
// BUSCA - GET /api/books/search?q=&category=&order=
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

    const { docs, total } = await openLibrary.searchWorks({
      query,
      subject: CATEGORY_SUBJECTS.get(category),
      sort: req.query?.order === 'newest' ? 'new' : undefined,
    });

    return res.json({
      books: mapSearchDocuments(docs, category || undefined),
      total,
    });
  } catch (error) {
    return responderFalha(res, error, 'Erro na busca de livros');
  }
};

module.exports = { search };
