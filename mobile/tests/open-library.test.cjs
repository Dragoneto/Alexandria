const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createServices, json, session } = require('./helpers/services.cjs');

const book = {
  id: 'OL27448W',
  title: 'The Lord of the Rings',
  authors: ['J.R.R. Tolkien'],
  category: 'Catálogo geral',
  coverUrl: 'https://covers.openlibrary.org/b/id/14625765-M.jpg',
  firstPublishYear: 1954,
  editionCount: 252,
  languages: ['eng', 'por'],
  openLibraryUrl: 'https://openlibrary.org/works/OL27448W',
};

async function loggedServices() {
  const h = createServices();
  await h.session.saveAuth(session);
  return h;
}

test('busca pelo backend com o token da sessão e devolve a página', async () => {
  const h = await loggedServices();
  h.fetch = async (url, options) => {
    const request = new URL(url);
    assert.equal(request.origin, 'http://localhost:3000');
    assert.equal(request.pathname, '/api/books/search');
    assert.equal(request.searchParams.get('q'), 'The Lord of the Rings');
    assert.equal(request.searchParams.get('page'), '1');
    assert.equal(request.searchParams.get('limit'), '10');
    assert.equal(request.searchParams.get('category'), null);
    assert.equal(request.searchParams.get('order'), null);
    assert.equal(options.headers.Authorization, `Bearer ${session.token}`);
    return json({ books: [book], total: 523, page: 1, limit: 10, hasMore: true });
  };
  const result = await h.books.searchBooks({ query: ' The Lord of the Rings ' });
  assert.deepEqual(result, { books: [book], total: 523, page: 1, limit: 10, hasMore: true });
});

test('envia categoria, ordenação e paginação para o backend', async () => {
  const h = await loggedServices();
  h.fetch = async (url) => {
    const request = new URL(url);
    assert.equal(request.searchParams.get('q'), 'hobbit');
    assert.equal(request.searchParams.get('category'), 'Fantasia');
    assert.equal(request.searchParams.get('order'), 'newest');
    assert.equal(request.searchParams.get('page'), '3');
    assert.equal(request.searchParams.get('limit'), '20');
    return json({ books: [], total: 45, page: 3, limit: 20, hasMore: false });
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

test('modo com capa remove resultados sem capa ou sem autoria', async () => {
  const h = await loggedServices();
  h.fetch = async () =>
    json({
      books: [
        { ...book, id: 'OL1W', category: 'Romance' },
        { ...book, id: 'OL2W', coverUrl: null },
        { ...book, id: 'OL3W', authors: [] },
      ],
      total: 3,
      page: 1,
      limit: 10,
      hasMore: false,
    });
  const result = await h.books.searchBooks({
    query: 'romance',
    category: 'Romance',
    quality: 'curated',
  });
  assert.deepEqual(
    result.books.map((item) => item.id),
    ['OL1W'],
  );
});

test('valida termo curto e traduz as falhas do backend', async () => {
  const h = await loggedServices();
  await assert.rejects(h.books.searchBooks({ query: 'a' }), { kind: 'validation' });
  assert.equal(h.requests.length, 0);
  h.fetch = async () => json({ error: 'Categoria inválida' }, 400);
  await assert.rejects(h.books.searchBooks({ query: 'livro' }), {
    name: 'OpenLibraryError',
    kind: 'validation',
    message: 'Categoria inválida',
  });
  h.fetch = async () => json({ error: 'A Open Library não conseguiu responder (HTTP 503).' }, 502);
  await assert.rejects(h.books.searchBooks({ query: 'livro' }), { kind: 'server', status: 502 });
  h.fetch = async () => json({ error: 'A Open Library demorou para responder.' }, 504);
  await assert.rejects(h.books.searchBooks({ query: 'livro' }), { kind: 'timeout' });
  h.fetch = async () => new Response('{', { status: 200 });
  await assert.rejects(h.books.searchBooks({ query: 'livro' }), { kind: 'server' });
  h.fetch = async () => json({ total: 3 });
  await assert.rejects(h.books.searchBooks({ query: 'livro' }), { kind: 'server' });
  h.fetch = async () => {
    throw new Error('offline');
  };
  await assert.rejects(h.books.searchBooks({ query: 'livro' }), { kind: 'network' });
});

test('sem sessão a busca falha como erro de autenticação, sem chamar a rede', async () => {
  const h = createServices();
  await assert.rejects(h.books.searchBooks({ query: 'livro' }), { name: 'ApiError', kind: 'auth' });
  assert.equal(h.requests.length, 0);
});

test('respeita cancelamento da tela sem converter em erro de rede', async () => {
  const h = await loggedServices();
  // Como o fetch real: rejeita na hora se o sinal já chegou abortado
  h.fetch = async (_url, { signal }) =>
    new Promise((_resolve, reject) => {
      const abort = () => reject(new DOMException('Aborted', 'AbortError'));
      if (signal.aborted) abort();
      else signal.addEventListener('abort', abort, { once: true });
    });

  const antes = new AbortController();
  const canceladaAntes = h.books.searchBooks({ query: 'cancelar', signal: antes.signal });
  antes.abort();
  await assert.rejects(canceladaAntes, { name: 'AbortError' });

  const durante = new AbortController();
  const canceladaDurante = h.books.searchBooks({ query: 'cancelar', signal: durante.signal });
  while (h.requests.length < 2) await new Promise((resolve) => setImmediate(resolve));
  durante.abort();
  await assert.rejects(canceladaDurante, { name: 'AbortError' });
});

const detail = {
  id: 'OL27448W',
  title: 'The Lord of the Rings',
  authors: ['J.R.R. Tolkien'],
  description: null,
  categories: ['Fantasy'],
  coverUrl: 'https://covers.openlibrary.org/b/id/14625765-L.jpg',
  openLibraryUrl: 'https://openlibrary.org/works/OL27448W',
};

test('detalhe busca o livro no backend e aceita livro sem sinopse', async () => {
  const h = await loggedServices();
  h.fetch = async (url, options) => {
    assert.equal(url, 'http://localhost:3000/api/books/OL27448W');
    assert.equal(options.headers.Authorization, `Bearer ${session.token}`);
    return json({ book: detail });
  };
  assert.deepEqual(await h.books.getBookDetail('OL27448W'), detail);
});

test('detalhe recusa identificador inválido sem chamar a rede', async () => {
  const h = await loggedServices();
  for (const id of ['', 'abc', 'OL1A', '../OL1W']) {
    await assert.rejects(h.books.getBookDetail(id), { kind: 'notFound' });
  }
  assert.equal(h.requests.length, 0);
});

test('detalhe traduz livro inexistente e falhas do backend', async () => {
  const h = await loggedServices();
  h.fetch = async () => json({ error: 'Livro não encontrado na Open Library.' }, 404);
  await assert.rejects(h.books.getBookDetail('OL1W'), { kind: 'notFound', status: 404 });
  h.fetch = async () => json({ error: 'A Open Library demorou para responder.' }, 504);
  await assert.rejects(h.books.getBookDetail('OL1W'), { kind: 'timeout' });
  h.fetch = async () => json({ error: 'indisponível' }, 502);
  await assert.rejects(h.books.getBookDetail('OL1W'), { kind: 'server' });
  h.fetch = async () => json({ livro: detail });
  await assert.rejects(h.books.getBookDetail('OL1W'), { kind: 'server' });
  h.fetch = async () => {
    throw new Error('offline');
  };
  await assert.rejects(h.books.getBookDetail('OL1W'), { kind: 'network' });
});

test('falha de conexão pede para conferir a internet', () => {
  const { OpenLibraryError, describeSearchError } = createServices().books;

  assert.deepEqual(describeSearchError(new OpenLibraryError('network', 'offline')), {
    title: 'Não foi possível conectar',
    message: 'Confira sua conexão com a internet e tente de novo.',
  });
});

test('timeout explica que a Open Library está lenta', () => {
  const { OpenLibraryError, describeSearchError } = createServices().books;

  assert.deepEqual(describeSearchError(new OpenLibraryError('timeout', 'lenta')), {
    title: 'A busca demorou demais',
    message: 'A Open Library está demorando para responder. Tente de novo em instantes.',
  });
});

test('erro do servidor avisa que o serviço está instável', () => {
  const { OpenLibraryError, describeSearchError } = createServices().books;

  assert.deepEqual(describeSearchError(new OpenLibraryError('server', 'HTTP 503', 503)), {
    title: 'A Open Library não respondeu',
    message: 'O serviço de livros está instável agora. Tente de novo em alguns minutos.',
  });
});

test('falha desconhecida cai na mensagem genérica', () => {
  const { describeSearchError } = createServices().books;
  const generica = {
    title: 'Não foi possível buscar livros',
    message: 'Tente de novo em instantes.',
  };

  assert.deepEqual(describeSearchError(new Error('qualquer coisa')), generica);
  assert.deepEqual(describeSearchError('nem é um erro'), generica);
});
