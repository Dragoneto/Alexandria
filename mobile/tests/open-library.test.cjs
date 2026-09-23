const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createServices, json } = require('./helpers/services.cjs');

test('mapeia a resposta real da busca e limita os campos solicitados', async () => {
  const h = createServices();
  h.fetch = async (url, options) => {
    const request = new URL(url);
    assert.equal(request.origin, 'https://openlibrary.org');
    assert.equal(request.pathname, '/search.json');
    assert.equal(request.searchParams.get('q'), 'The Lord of the Rings');
    assert.equal(request.searchParams.get('lang'), 'pt');
    assert.equal(request.searchParams.get('limit'), '10');
    assert.equal(
      request.searchParams.get('fields'),
      'key,title,author_name,cover_i,first_publish_year,edition_count,language',
    );
    assert.equal(options.headers.Accept, 'application/json');
    return json({
      numFound: 523,
      start: 0,
      docs: [
        {
          key: '/works/OL27448W',
          title: 'The Lord of the Rings',
          author_name: ['J.R.R. Tolkien'],
          cover_i: 14625765,
          edition_count: 252,
          first_publish_year: 1954,
          language: ['eng', 'por'],
        },
      ],
    });
  };
  const result = await h.books.searchBooks({ query: ' The Lord of the Rings ' });
  assert.equal(result.total, 523);
  assert.equal(result.hasMore, true);
  assert.deepEqual(result.books[0], {
    id: 'OL27448W',
    title: 'The Lord of the Rings',
    authors: ['J.R.R. Tolkien'],
    category: 'Catálogo geral',
    coverUrl: 'https://covers.openlibrary.org/b/id/14625765-M.jpg?default=false',
    firstPublishYear: 1954,
    editionCount: 252,
    languages: ['eng', 'por'],
    openLibraryUrl: 'https://openlibrary.org/works/OL27448W',
  });
});

test('envia categoria, ordenação e paginação compatíveis com a API', async () => {
  const h = createServices();
  h.fetch = async (url) => {
    const request = new URL(url);
    assert.equal(request.searchParams.get('q'), 'hobbit subject:fantasy');
    assert.equal(request.searchParams.get('sort'), 'new');
    assert.equal(request.searchParams.get('page'), '3');
    assert.equal(request.searchParams.get('limit'), '20');
    return json({ num_found: 45, docs: [] });
  };
  const result = await h.books.searchBooks({
    query: 'hobbit',
    category: 'Fantasia',
    order: 'newest',
    page: 3,
    limit: 100,
  });
  assert.equal(result.limit, 20);
  assert.equal(result.hasMore, false);
});

test('modo com capa remove resultados incompletos e ignora documentos inválidos', async () => {
  const h = createServices();
  h.fetch = async () =>
    json({
      numFound: 3,
      docs: [
        {
          key: '/works/OL1W',
          title: 'Completo',
          author_name: ['Autora'],
          cover_i: 10,
        },
        { key: '/works/OL2W', title: 'Sem capa', author_name: ['Autor'] },
        { key: '/authors/OL3A', title: 'Chave inválida', cover_i: 12 },
      ],
    });
  const result = await h.books.searchBooks({
    query: 'romance',
    category: 'Romance',
    quality: 'curated',
  });
  assert.equal(result.books.length, 1);
  assert.equal(result.books[0].category, 'Romance');
});

test('valida termo curto e traduz falhas HTTP, JSON e rede', async () => {
  const h = createServices();
  await assert.rejects(h.books.searchBooks({ query: 'a' }), { kind: 'validation' });
  assert.equal(h.requests.length, 0);
  h.fetch = async () => new Response('indisponível', { status: 503 });
  await assert.rejects(h.books.searchBooks({ query: 'livro' }), { kind: 'server', status: 503 });
  h.fetch = async () => new Response('{', { status: 200 });
  await assert.rejects(h.books.searchBooks({ query: 'livro' }), { kind: 'server' });
  h.fetch = async () => json(null);
  await assert.rejects(h.books.searchBooks({ query: 'livro' }), { kind: 'server' });
  h.fetch = async () => json({ numFound: Number.MAX_SAFE_INTEGER + 1, docs: [] });
  assert.equal((await h.books.searchBooks({ query: 'livro' })).total, 0);
  h.fetch = async () => {
    throw new Error('offline');
  };
  await assert.rejects(h.books.searchBooks({ query: 'livro' }), { kind: 'network' });
});

test('respeita cancelamento da tela sem converter em erro de rede', async () => {
  const h = createServices();
  const controller = new AbortController();
  h.fetch = async (_url, { signal }) =>
    new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), {
        once: true,
      });
    });
  const search = h.books.searchBooks({ query: 'cancelar', signal: controller.signal });
  controller.abort();
  await assert.rejects(search, { name: 'AbortError' });
});
