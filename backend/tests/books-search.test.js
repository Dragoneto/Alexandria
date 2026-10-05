const assert = require('node:assert/strict');
const { afterEach, test } = require('node:test');

const { search } = require('../src/controllers/bookController');

const fetchOriginal = global.fetch;
let chamadas;

/** Troca o fetch global por uma resposta fixa e guarda as URLs pedidas. */
function simularOpenLibrary(responder) {
  chamadas = [];
  global.fetch = async (url, options) => {
    chamadas.push({ url: new URL(url), options });
    return responder(new URL(url));
  };
}

function respostaJson(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function fakeResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

async function buscar(query) {
  const res = fakeResponse();
  await search({ query }, res);
  return res;
}

afterEach(() => {
  global.fetch = fetchOriginal;
});

test('termo curto é recusado sem chamar a Open Library', async () => {
  simularOpenLibrary(() => respostaJson({ docs: [] }));
  const res = await buscar({ q: ' a ' });
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /dois caracteres/);
  assert.equal(chamadas.length, 0);
});

test('categoria desconhecida é recusada', async () => {
  simularOpenLibrary(() => respostaJson({ docs: [] }));
  const res = await buscar({ q: 'dom casmurro', category: 'constructor' });
  assert.equal(res.statusCode, 400);
  assert.equal(chamadas.length, 0);
});

test('busca devolve os livros convertidos e o total', async () => {
  simularOpenLibrary(() =>
    respostaJson({
      numFound: 42,
      docs: [
        {
          key: '/works/OL123W',
          title: ' Dom Casmurro ',
          author_name: ['Machado de Assis'],
          cover_i: 987,
          first_publish_year: 1899,
          edition_count: 12,
          language: ['por'],
        },
        { key: '/authors/OL1A', title: 'Documento sem obra' },
      ],
    }),
  );

  const res = await buscar({ q: 'dom casmurro' });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.total, 42);
  assert.deepEqual(res.body.books, [
    {
      id: 'OL123W',
      title: 'Dom Casmurro',
      authors: ['Machado de Assis'],
      category: 'Catálogo geral',
      coverUrl: 'https://covers.openlibrary.org/b/id/987-M.jpg',
      firstPublishYear: 1899,
      editionCount: 12,
      languages: ['por'],
      openLibraryUrl: 'https://openlibrary.org/works/OL123W',
    },
  ]);

  const { url, options } = chamadas[0];
  assert.equal(url.origin + url.pathname, 'https://openlibrary.org/search.json');
  assert.equal(url.searchParams.get('q'), 'dom casmurro');
  assert.equal(url.searchParams.get('sort'), null);
  assert.match(url.searchParams.get('fields'), /cover_edition_key/);
  assert.ok(options.headers['User-Agent']);
});

test('categoria e ordenação viram assunto e sort da Open Library', async () => {
  simularOpenLibrary(() => respostaJson({ numFound: 0, docs: [] }));

  const res = await buscar({ q: 'tolkien', category: 'Fantasia', order: 'newest' });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { books: [], total: 0 });
  assert.equal(chamadas[0].url.searchParams.get('q'), 'tolkien subject:fantasy');
  assert.equal(chamadas[0].url.searchParams.get('sort'), 'new');
});

test('total inválido cai para a quantidade de documentos', async () => {
  simularOpenLibrary(() => respostaJson({ numFound: '42', docs: [{ key: '/works/OL1W', title: 'A' }] }));
  const res = await buscar({ q: 'livro' });
  assert.equal(res.body.total, 1);
});

test('erro HTTP da Open Library vira 502', async () => {
  simularOpenLibrary(() => respostaJson({ error: 'indisponível' }, 503));
  const res = await buscar({ q: 'livro' });
  assert.equal(res.statusCode, 502);
  assert.match(res.body.error, /HTTP 503/);
});

test('resposta sem lista de documentos vira 502', async () => {
  simularOpenLibrary(() => respostaJson(null));
  const res = await buscar({ q: 'livro' });
  assert.equal(res.statusCode, 502);
  assert.match(res.body.error, /resposta inválida/);
});

test('corpo que não é JSON vira 502', async () => {
  simularOpenLibrary(() => new Response('<html>erro</html>', { status: 200 }));
  const res = await buscar({ q: 'livro' });
  assert.equal(res.statusCode, 502);
});

test('falha de conexão vira 502', async () => {
  simularOpenLibrary(() => {
    throw new TypeError('fetch failed');
  });
  const res = await buscar({ q: 'livro' });
  assert.equal(res.statusCode, 502);
  assert.match(res.body.error, /conectar/);
});

test('demora da Open Library vira 504', async () => {
  simularOpenLibrary(() => {
    throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
  });
  const res = await buscar({ q: 'livro' });
  assert.equal(res.statusCode, 504);
  assert.match(res.body.error, /demorou/);
});
