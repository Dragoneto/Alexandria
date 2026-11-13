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

test('modo com capa remove resultados sem capa de verdade ou sem autoria', async () => {
  const h = await loggedServices();
  h.fetch = async () =>
    json({
      books: [
        { ...book, id: 'OL1W', category: 'Romance' },
        { ...book, id: 'OL2W', coverUrl: null },
        { ...book, id: 'OL3W', authors: [] },
        // Capa montada pelo ISBN quase sempre não existe na Open Library
        {
          ...book,
          id: 'OL4W',
          coverUrl: 'https://covers.openlibrary.org/b/isbn/9788535914849-M.jpg?default=false',
        },
        { ...book, id: 'OL5W', coverUrl: 'https://exemplo.com/placeholder.png' },
      ],
      total: 5,
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

test('categoria sem termo busca só pela categoria; sem categoria o termo é obrigatório', async () => {
  const h = await loggedServices();
  h.fetch = async () => json({ books: [], total: 0, page: 1, limit: 10, hasMore: false });
  await h.books.searchBooks({ query: '', category: 'Poesia' });
  assert.match(h.requests[0].url, /[?&]q=&/);
  assert.match(h.requests[0].url, /category=Poesia/);
  await assert.rejects(h.books.searchBooks({ query: '' }), { kind: 'validation' });
  await assert.rejects(h.books.searchBooks({ query: 'a', category: 'Poesia' }), {
    kind: 'validation',
  });
  assert.equal(h.requests.length, 1);
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

test('resposta fora do formato não chega quebrada na tela', async () => {
  const h = await loggedServices();
  h.fetch = async () =>
    json({ books: [book, null, 'texto', { id: 'OL9W' }, { ...book, id: 'OL8W', authors: 'x' }] });
  assert.deepEqual(await h.books.searchBooks({ query: 'livro', page: 2 }), {
    books: [book],
    total: 1,
    page: 2,
    limit: 10,
    hasMore: false,
  });
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
  while (h.requests.length < 1) await new Promise((resolve) => setImmediate(resolve));
  durante.abort();
  await assert.rejects(canceladaDurante, { name: 'AbortError' });
});

const detail = {
  id: 'OL27448W',
  title: 'The Lord of the Rings',
  authors: ['J.R.R. Tolkien'],
  description: null,
  descriptionTranslated: false,
  categories: ['Fantasy'],
  categoriesTranslated: false,
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
  // Sem título traduzido, o original é o próprio título
  assert.deepEqual(await h.books.getBookDetail('OL27448W'), {
    ...detail,
    originalTitle: detail.title,
    titleTranslated: false,
  });
});

test('detalhe repassa o título traduzido junto com o original', async () => {
  const h = await loggedServices();
  h.fetch = async () =>
    json({
      book: {
        ...detail,
        title: 'O Senhor dos Anéis',
        originalTitle: 'The Lord of the Rings',
        titleTranslated: true,
      },
    });
  const book = await h.books.getBookDetail('OL27448W');
  assert.equal(book.title, 'O Senhor dos Anéis');
  assert.equal(book.originalTitle, 'The Lord of the Rings');
  assert.equal(book.titleTranslated, true);
});

test('detalhe mostra a sinopse sem a marcação Markdown da Open Library', async () => {
  const h = await loggedServices();
  h.fetch = async () =>
    json({
      book: {
        id: 'OL1003040W',
        title: 'Dom Casmurro',
        description:
          '**Dom Casmurro**, de *Machado*, foi publicado em 1899.\n\n----------\n\n' +
          'Veja a [edição comentada][1] e o [verbete](https://example.com/x).\n\n' +
          '[1]: https://example.com/edicao',
      },
    });
  const book = await h.books.getBookDetail('OL1003040W');
  assert.equal(
    book.description,
    'Dom Casmurro, de Machado, foi publicado em 1899.\n\nVeja a edição comentada e o verbete.',
  );
});

test('textoSemMarkdown preserva asteriscos soltos e nomes com sublinhado', async () => {
  const h = await loggedServices();
  assert.equal(h.books.textoSemMarkdown('Nota 5 * 3 = 15'), 'Nota 5 * 3 = 15');
  assert.equal(h.books.textoSemMarkdown('arquivo_final_v2'), 'arquivo_final_v2');
});

test('detalhe com campos faltando chega completo para a tela', async () => {
  const h = await loggedServices();
  h.fetch = async () => json({ book: { id: 'OL1W', title: 'Só o título', description: '  ' } });
  assert.deepEqual(await h.books.getBookDetail('OL1W'), {
    id: 'OL1W',
    title: 'Só o título',
    originalTitle: 'Só o título',
    titleTranslated: false,
    authors: [],
    description: null,
    descriptionTranslated: false,
    categories: [],
    categoriesTranslated: false,
    coverUrl: null,
    openLibraryUrl: 'https://openlibrary.org/works/OL1W',
  });
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
