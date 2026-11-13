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
      originalTitle: 'Dom Casmurro',
      titleTranslated: false,
      categories: [],
      categoriesTranslated: false,
      authors: ['Machado de Assis'],
      category: 'Catálogo geral',
      coverUrl: 'https://covers.openlibrary.org/b/id/987-M.jpg?default=false',
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
  assert.equal(url.searchParams.get('page'), '1');
  assert.equal(url.searchParams.get('limit'), '10');
  assert.match(url.searchParams.get('fields'), /cover_edition_key/);
  assert.ok(options.headers['User-Agent']);
});

test('ano de publicação no futuro distante vira desconhecido; o ano que vem continua', async () => {
  const ano = new Date().getFullYear();
  const obra = (n, first_publish_year) => ({ key: `/works/OL${n}W`, title: `Obra ${n}`, first_publish_year });
  simularOpenLibrary(() =>
    respostaJson({ numFound: 3, docs: [obra(1, 2207), obra(2, ano + 1), obra(3, ano + 2)] }),
  );
  const res = await buscar({ q: 'poesia' });
  assert.deepEqual(
    res.body.books.map((book) => book.firstPublishYear),
    [null, ano + 1, null],
  );
});

test('categoria e ordenação viram assunto e sort da Open Library', async () => {
  simularOpenLibrary(() => respostaJson({ numFound: 0, docs: [] }));

  const res = await buscar({ q: 'tolkien', category: 'Fantasia', order: 'newest' });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { books: [], total: 0, page: 1, limit: 10, hasMore: false });
  assert.equal(chamadas[0].url.searchParams.get('q'), '(tolkien) subject:fantasy');
  assert.equal(chamadas[0].url.searchParams.get('sort'), 'new');
});

test('categoria sem termo lista os livros da categoria; categorias novas usam o filtro do catálogo', async () => {
  simularOpenLibrary(() => respostaJson({ numFound: 0, docs: [] }));

  assert.equal((await buscar({ q: '', category: 'Poesia' })).statusCode, 200);
  assert.equal(chamadas[0].url.searchParams.get('q'), 'subject:poetry');

  assert.equal((await buscar({ category: 'Biografias históricas' })).statusCode, 200);
  assert.equal(chamadas[1].url.searchParams.get('q'), 'subject:biography subject:history');

  assert.equal((await buscar({ q: 'amado', category: 'Brasil' })).statusCode, 200);
  assert.equal(chamadas[2].url.searchParams.get('q'), '(amado) place:brazil');
});

test('termo com aspas sem par ou operador solto não engole o filtro da categoria', async () => {
  simularOpenLibrary(() => respostaJson({ numFound: 0, docs: [] }));
  const enviados = [
    ['"dragon', 'Fantasia', '(dragon) subject:fantasy'],
    ['dragon OR', 'Fantasia', '(dragon) subject:fantasy'],
    ['dragon -', 'Fantasia', '(dragon) subject:fantasy'],
    ['OR dragon', 'Fantasia', '(dragon) subject:fantasy'],
    ['(dragon', 'Fantasia', '(dragon) subject:fantasy'],
    ['cats OR dogs', 'Fantasia', '(cats OR dogs) subject:fantasy'],
    ['"dom casmurro"', 'Brasil', '("dom casmurro") place:brazil'],
    ['OR', 'Fantasia', 'subject:fantasy'],
    ['"dom casmurro', undefined, 'dom casmurro'],
    ['NOT dragon', undefined, 'NOT dragon'],
  ];
  for (const [q, category] of enviados) {
    assert.equal((await buscar({ q, category })).statusCode, 200, q);
  }
  assert.deepEqual(
    chamadas.map((chamada) => chamada.url.searchParams.get('q')),
    enviados.map(([, , esperado]) => esperado),
  );
});

test('sem categoria o termo continua obrigatório; categoria fora do catálogo é recusada', async () => {
  simularOpenLibrary(() => respostaJson({ numFound: 0, docs: [] }));
  assert.equal((await buscar({ q: '' })).statusCode, 400);
  assert.equal((await buscar({ q: 'a', category: 'Poesia' })).statusCode, 400);
  assert.equal((await buscar({ q: '', category: 'Em inglês' })).statusCode, 400);
  assert.equal(chamadas.length, 0);
});

test('catálogo tem nomes únicos e todo filtro usa subject ou place', () => {
  const { GRUPOS, FILTRO_POR_CATEGORIA } = require('../src/constants/categorias');
  const nomes = GRUPOS.flatMap((g) => [g.nome, ...g.subcategorias.map((s) => s.nome)]);
  assert.equal(new Set(nomes).size, nomes.length);
  assert.equal(FILTRO_POR_CATEGORIA.size, nomes.length);
  for (const filtro of FILTRO_POR_CATEGORIA.values()) assert.match(filtro, /^(subject|place):/);
  // "Tudo em <grupo>" não pode ser só uma das subcategorias dele (Lugares era igual a Brasil)
  for (const grupo of GRUPOS) {
    for (const sub of grupo.subcategorias) assert.notEqual(sub.filtro, grupo.filtro, sub.nome);
  }
  assert.equal(
    FILTRO_POR_CATEGORIA.get('Lugares'),
    'place:(brazil OR india OR indonesia OR "united states")',
  );
  // As seis categorias antigas continuam valendo (links e URLs já salvos)
  for (const antiga of ['Fantasia', 'Romance', 'História', 'Tecnologia', 'Biografia', 'Mistério']) {
    assert.ok(FILTRO_POR_CATEGORIA.has(antiga), antiga);
  }
});

test('página e tamanho são repassados para a Open Library', async () => {
  simularOpenLibrary(() => respostaJson({ numFound: 45, docs: [] }));

  const res = await buscar({ q: 'livro', page: '3', limit: '15' });

  assert.equal(res.statusCode, 200);
  assert.equal(chamadas[0].url.searchParams.get('page'), '3');
  assert.equal(chamadas[0].url.searchParams.get('limit'), '15');
  assert.equal(res.body.page, 3);
  assert.equal(res.body.limit, 15);
  assert.equal(res.body.hasMore, false);
});

test('hasMore indica se ainda há resultados depois da página', async () => {
  simularOpenLibrary(() => respostaJson({ numFound: 45, docs: [] }));
  assert.equal((await buscar({ q: 'livro', page: '2', limit: '15' })).body.hasMore, true);
  assert.equal((await buscar({ q: 'livro', page: '4', limit: '15' })).body.hasMore, false);
});

test('tamanho acima do máximo é limitado a 20', async () => {
  simularOpenLibrary(() => respostaJson({ numFound: 500, docs: [] }));
  const res = await buscar({ q: 'livro', limit: '100' });
  assert.equal(res.body.limit, 20);
  assert.equal(chamadas[0].url.searchParams.get('limit'), '20');
});

test('página ou tamanho fora do formato são recusados', async () => {
  simularOpenLibrary(() => respostaJson({ docs: [] }));
  const invalidos = [
    { page: '0' },
    { page: '-1' },
    { page: '1.5' },
    { page: 'abc' },
    { page: '' },
    { page: ['1', '2'] },
    { limit: '0' },
    { limit: 'dez' },
  ];
  for (const parametros of invalidos) {
    const res = await buscar({ q: 'livro', ...parametros });
    assert.equal(res.statusCode, 400, JSON.stringify(parametros));
  }
  assert.equal(chamadas.length, 0);
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

test('com DeepL, a busca traduz só os títulos, numa chamada, e não manda assuntos', async () => {
  const chaveOriginal = process.env.DEEPL_AUTH_KEY;
  process.env.DEEPL_AUTH_KEY = 'test-key:fx';
  const enviados = [];
  try {
    global.fetch = async (url, options) => {
      const parsed = new URL(url);
      if (parsed.hostname === 'openlibrary.org') {
        return respostaJson({
          numFound: 3,
          docs: [
            { key: '/works/OL1W', title: 'The Hobbit', subject: ['Fantasy fiction', 'Dragons'] },
            { key: '/works/OL2W', title: 'Dom Casmurro', subject: ['Brazilian fiction'] },
            { key: '/works/OL3W', title: 'The Hobbit', subject: ['Middle Earth'] },
          ],
        });
      }
      const { text } = JSON.parse(options.body);
      enviados.push(text);
      return respostaJson({
        translations: text.map((titulo) =>
          titulo === 'Dom Casmurro'
            ? { detected_source_language: 'PT', text: titulo }
            : { detected_source_language: 'EN', text: 'O Hobbit' },
        ),
      });
    };

    const res = await buscar({ q: 'hobbit' });

    // Uma chamada só, sem título repetido e sem os assuntos
    assert.deepEqual(enviados, [['The Hobbit', 'Dom Casmurro']]);
    assert.deepEqual(
      res.body.books.map((book) => [book.title, book.titleTranslated, book.originalTitle]),
      [
        ['O Hobbit', true, 'The Hobbit'],
        ['Dom Casmurro', false, 'Dom Casmurro'],
        ['O Hobbit', true, 'The Hobbit'],
      ],
    );

    // A mesma busca de novo não gasta nada do DeepL: tudo vem do cache
    await buscar({ q: 'hobbit' });
    assert.equal(enviados.length, 1);
  } finally {
    if (chaveOriginal === undefined) delete process.env.DEEPL_AUTH_KEY;
    else process.env.DEEPL_AUTH_KEY = chaveOriginal;
  }
});
