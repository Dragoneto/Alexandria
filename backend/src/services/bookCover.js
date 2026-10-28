// Monta a URL da capa de um livro da Open Library, com fallback entre os
// identificadores disponíveis (#33).
//
// Ordem de tentativa: cover_i -> ISBN -> OLID da edição -> placeholder.
// O placeholder vem de BOOK_COVER_PLACEHOLDER_URL; sem ele, retorna null para
// o cliente decidir como exibir a ausência de capa.
//
// As URLs levam default=false: sem isso a Open Library responde 200 com uma
// imagem vazia quando a capa não existe, e o cliente não tem como perceber.

const COVER_BASE_URL = 'https://covers.openlibrary.org';
const VALID_SIZES = new Set(['S', 'M', 'L']);

function positiveInteger(value) {
  return Number.isInteger(value) && value > 0 ? value : null;
}

function cleanIsbn(value) {
  if (typeof value !== 'string') return null;
  const isbn = value.replace(/[-\s]/g, '');
  return /^(\d{9}[\dXx]|\d{13})$/.test(isbn) ? isbn.toUpperCase() : null;
}

function firstValidIsbn(value) {
  const candidates = Array.isArray(value) ? value : [value];
  for (const candidate of candidates) {
    const isbn = cleanIsbn(candidate);
    if (isbn) return isbn;
  }
  return null;
}

function cleanOlid(value) {
  return typeof value === 'string' && /^OL\d+M$/.test(value) ? value : null;
}

function placeholderUrl() {
  const url = process.env.BOOK_COVER_PLACEHOLDER_URL?.trim();
  return url || null;
}

/**
 * @param {object} source
 * @param {unknown} [source.coverId]  campo cover_i da Open Library
 * @param {unknown} [source.isbn]     ISBN (string) ou lista de ISBNs
 * @param {unknown} [source.olid]     OLID da edição (ex.: OL7353617M)
 * @param {'S'|'M'|'L'} [size]        tamanho da imagem (padrão: M)
 * @returns {string|null}
 */
function buildCoverUrl(source = {}, size = 'M') {
  const imageSize = VALID_SIZES.has(size) ? size : 'M';

  const coverId = positiveInteger(source.coverId);
  if (coverId) return `${COVER_BASE_URL}/b/id/${coverId}-${imageSize}.jpg?default=false`;

  const isbn = firstValidIsbn(source.isbn);
  if (isbn) return `${COVER_BASE_URL}/b/isbn/${isbn}-${imageSize}.jpg?default=false`;

  const olid = cleanOlid(source.olid);
  if (olid) return `${COVER_BASE_URL}/b/olid/${olid}-${imageSize}.jpg?default=false`;

  return placeholderUrl();
}

module.exports = { buildCoverUrl };
