// Converte os campos de um documento de busca da Open Library para o formato
// usado pela API do Alexandria (#30). O formato de saída é o mesmo de
// BookSearchItem em mobile/src/services/open-library.ts.

const { buildCoverUrl } = require('./bookCover');

const OPEN_LIBRARY_URL = 'https://openlibrary.org';
const MAX_AUTHORS = 3;
const MAX_LANGUAGES = 5;

// Campos a pedir à Open Library em /search.json (parâmetro `fields`).
const SEARCH_FIELDS = [
  'key',
  'title',
  'author_name',
  'cover_i',
  'cover_edition_key',
  'isbn',
  'first_publish_year',
  'edition_count',
  'language',
].join(',');

function stringArray(value, max) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === 'string' && item.trim())
    .map((item) => item.trim())
    .slice(0, max);
}

function positiveInteger(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function normalizeKey(value) {
  if (typeof value !== 'string' || !/^\/?works\/OL\d+W$/.test(value)) return null;
  return value.startsWith('/') ? value : `/${value}`;
}

/**
 * Converte um documento da Open Library em um livro da API.
 * Retorna null se o documento não tiver chave de obra ou título válidos.
 */
function mapSearchDocument(document, selectedCategory) {
  if (!document || typeof document !== 'object') return null;

  const key = normalizeKey(document.key);
  const title = typeof document.title === 'string' ? document.title.trim() : '';
  if (!key || !title) return null;

  return {
    id: key.slice('/works/'.length),
    title,
    authors: stringArray(document.author_name, MAX_AUTHORS),
    category: selectedCategory || 'Catálogo geral',
    coverUrl: buildCoverUrl({
      coverId: document.cover_i,
      isbn: document.isbn,
      olid: document.cover_edition_key,
    }),
    firstPublishYear: positiveInteger(document.first_publish_year, 0) || null,
    editionCount: positiveInteger(document.edition_count, 1),
    languages: stringArray(document.language, MAX_LANGUAGES),
    openLibraryUrl: `${OPEN_LIBRARY_URL}${key}`,
  };
}

/** Converte a lista de documentos, descartando os inválidos. */
function mapSearchDocuments(documents, selectedCategory) {
  if (!Array.isArray(documents)) return [];
  return documents
    .map((document) => mapSearchDocument(document, selectedCategory))
    .filter(Boolean);
}

module.exports = { SEARCH_FIELDS, mapSearchDocument, mapSearchDocuments };
