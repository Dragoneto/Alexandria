const assert = require('node:assert/strict');
const { afterEach, test } = require('node:test');

const { detail } = require('../src/controllers/bookController');
const { normalizeDescription } = require('../src/services/bookMapper');

const fetchOriginal = global.fetch;
let caminhos;

function respostaJson(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Troca o fetch global por respostas fixas por caminho; o que faltar responde 404. */
function simularOpenLibrary(respostas) {
  caminhos = [];
  global.fetch = async (url) => {
    const { pathname } = new URL(url);
    caminhos.push(pathname);
    const resposta = respostas[pathname];
    if (typeof resposta === 'function') return resposta();
    return resposta === undefined ? respostaJson({ error: 'notfound' }, 404) : respostaJson(resposta);
  };
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

async function detalhar(id) {
  const res = fakeResponse();
  await detail({ params: { id } }, res);
  return res;
}

function obra(extra) {
  return {
    key: '/works/OL100W',
    title: 'Dom Casmurro',
    type: { key: '/type/work' },
    authors: [{ author: { key: '/authors/OL1A' }, type: { key: '/type/author_role' } }],
    ...extra,
  };
}

const AUTOR = { '/authors/OL1A.json': { name: 'Machado de Assis' } };

afterEach(() => {
  global.fetch = fetchOriginal;
});

test('descrição aceita texto puro, objeto com valor e ausência', () => {
  assert.equal(normalizeDescription('  Um clássico.  '), 'Um clássico.');
  assert.equal(normalizeDescription({ type: '/type/text', value: ' Um clássico. ' }), 'Um clássico.');
  assert.equal(normalizeDescription({ type: '/type/text' }), null);
  assert.equal(normalizeDescription({ type: '/type/text', value: 42 }), null);
  assert.equal(normalizeDescription('   '), null);
  assert.equal(normalizeDescription(undefined), null);
  assert.equal(normalizeDescription(null), null);
  assert.equal(normalizeDescription(['texto']), null);
});

test('identificador fora do padrão é recusado sem chamar a Open Library', async () => {
  simularOpenLibrary({});
  for (const id of ['', 'abc', 'OL1A', 'OL1W/../x', '../OL1W']) {
    const res = await detalhar(id);
    assert.equal(res.statusCode, 400, id);
  }
  assert.equal(caminhos.length, 0);
});

test('detalhe com descrição em texto puro', async () => {
  simularOpenLibrary({
    ...AUTOR,
    '/works/OL100W.json': obra({
      description: 'Bentinho conta a própria história.',
      covers: [-1, 555, 777],
      subjects: ['Ficção', ' Ciúme ', 3, 'Brasil', 'Romance', 'Século XIX', 'Literatura'],
    }),
  });

  const res = await detalhar('OL100W');

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    book: {
      id: 'OL100W',
      title: 'Dom Casmurro',
      authors: ['Machado de Assis'],
      description: 'Bentinho conta a própria história.',
      categories: ['Ficção', 'Ciúme', 'Brasil', 'Romance', 'Século XIX'],
      coverUrl: 'https://covers.openlibrary.org/b/id/555-L.jpg?default=false',
      openLibraryUrl: 'https://openlibrary.org/works/OL100W',
    },
  });
});

test('detalhe com descrição em objeto', async () => {
  simularOpenLibrary({
    ...AUTOR,
    '/works/OL100W.json': obra({ description: { type: '/type/text', value: 'Texto do objeto.' } }),
  });
  const res = await detalhar('OL100W');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.book.description, 'Texto do objeto.');
});

test('livro sem descrição, capa, assunto e autor não quebra', async () => {
  simularOpenLibrary({ '/works/OL100W.json': { key: '/works/OL100W', title: 'Sem nada' } });
  const res = await detalhar('OL100W');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.book.description, null);
  assert.equal(res.body.book.coverUrl, null);
  assert.deepEqual(res.body.book.categories, []);
  assert.deepEqual(res.body.book.authors, []);
});

test('autor que falha fica de fora e o detalhe continua', async () => {
  simularOpenLibrary({
    ...AUTOR,
    '/authors/OL3A.json': () => {
      throw new DOMException('timeout', 'TimeoutError');
    },
    '/works/OL100W.json': obra({
      authors: [
        { author: { key: '/authors/OL1A' } },
        { author: '/authors/OL2A' },
        { author: { key: '/authors/OL3A' } },
        { author: { key: '/authors/OL1A' } },
        { author: { key: '/people/intruso' } },
      ],
    }),
  });

  const res = await detalhar('OL100W');

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.book.authors, ['Machado de Assis']);
  assert.deepEqual(caminhos.filter((caminho) => caminho.startsWith('/authors/')).sort(), [
    '/authors/OL1A.json',
    '/authors/OL2A.json',
    '/authors/OL3A.json',
  ]);
});

test('obra unificada segue para a obra de destino', async () => {
  simularOpenLibrary({
    ...AUTOR,
    '/works/OL9W.json': { key: '/works/OL9W', type: { key: '/type/redirect' }, location: '/works/OL100W' },
    '/works/OL100W.json': obra(),
  });
  const res = await detalhar('OL9W');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.book.id, 'OL100W');
});

test('livro inexistente vira 404', async () => {
  simularOpenLibrary({});
  const res = await detalhar('OL404W');
  assert.equal(res.statusCode, 404);
  assert.match(res.body.error, /não encontrado/);
});

test('obra sem título vira 404', async () => {
  simularOpenLibrary({ '/works/OL100W.json': { key: '/works/OL100W', type: { key: '/type/delete' } } });
  const res = await detalhar('OL100W');
  assert.equal(res.statusCode, 404);
});

test('falha da Open Library no detalhe vira 502 e demora vira 504', async () => {
  simularOpenLibrary({ '/works/OL100W.json': () => respostaJson({}, 500) });
  assert.equal((await detalhar('OL100W')).statusCode, 502);

  simularOpenLibrary({
    '/works/OL100W.json': () => {
      throw new DOMException('timeout', 'TimeoutError');
    },
  });
  assert.equal((await detalhar('OL100W')).statusCode, 504);
});
