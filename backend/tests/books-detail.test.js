const assert = require('node:assert/strict');
const { afterEach, test } = require('node:test');

const { detail } = require('../src/controllers/bookController');
const { normalizeDescription } = require('../src/services/bookMapper');

const fetchOriginal = global.fetch;
const authKeyOriginal = process.env.DEEPL_AUTH_KEY;
const apiUrlOriginal = process.env.DEEPL_API_URL;
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
  if (authKeyOriginal === undefined) delete process.env.DEEPL_AUTH_KEY;
  else process.env.DEEPL_AUTH_KEY = authKeyOriginal;
  if (apiUrlOriginal === undefined) delete process.env.DEEPL_API_URL;
  else process.env.DEEPL_API_URL = apiUrlOriginal;
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
  delete process.env.DEEPL_AUTH_KEY;
  simularOpenLibrary({
    ...AUTOR,
    '/works/OL100W.json': obra({
      description: 'Bentinho conta a própria história.',
      covers: [-1, 555, 777],
      subjects: ['Ficção', ' Ciúme ', 3, 'Ficção', 'Brasil', 'Romance', 'Século XIX', 'Literatura'],
    }),
  });

  const res = await detalhar('OL100W');

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    book: {
      id: 'OL100W',
      title: 'Dom Casmurro',
      titleTranslated: false,
      originalTitle: 'Dom Casmurro',
      authors: ['Machado de Assis'],
      description: 'Bentinho conta a própria história.',
      descriptionTranslated: false,
      categories: ['Ficção', 'Ciúme', 'Brasil', 'Romance', 'Século XIX'],
      categoriesTranslated: false,
      coverUrl: 'https://covers.openlibrary.org/b/id/555-L.jpg?default=false',
      openLibraryUrl: 'https://openlibrary.org/works/OL100W',
    },
  });
});

test('etiquetas internas da Open Library não viram categoria nem tomam o lugar de uma', async () => {
  delete process.env.DEEPL_AUTH_KEY;
  simularOpenLibrary({
    ...AUTOR,
    '/works/OL100W.json': obra({
      subjects: ['series:Harry_Potter', 'nyt:series_books=2006-09-16', 'Ghosts', 'History: Ancient', 'Magic', 'Witches', 'Wizards', 'Owls'],
    }),
  });
  const res = await detalhar('OL100W');
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.book.categories, ['Ghosts', 'History: Ancient', 'Magic', 'Witches', 'Wizards']);
});

test('detalhe com descrição em objeto', async () => {
  delete process.env.DEEPL_AUTH_KEY;
  simularOpenLibrary({
    ...AUTOR,
    '/works/OL100W.json': obra({ description: { type: '/type/text', value: 'Texto do objeto.' } }),
  });
  const res = await detalhar('OL100W');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.book.description, 'Texto do objeto.');
  assert.equal(res.body.book.descriptionTranslated, false);
});

test('livro sem descrição, capa, assunto e autor não quebra', async () => {
  delete process.env.DEEPL_AUTH_KEY;
  simularOpenLibrary({ '/works/OL100W.json': { key: '/works/OL100W', title: 'Sem nada' } });
  const res = await detalhar('OL100W');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.book.description, null);
  assert.equal(res.body.book.descriptionTranslated, false);
  assert.equal(res.body.book.coverUrl, null);
  assert.deepEqual(res.body.book.categories, []);
  assert.equal(res.body.book.categoriesTranslated, true);
  assert.deepEqual(res.body.book.authors, []);
});

test('autor que falha fica de fora e o detalhe continua', async () => {
  delete process.env.DEEPL_AUTH_KEY;
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
  delete process.env.DEEPL_AUTH_KEY;
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

test('detalhe traduz título, sinopse e categorias quando DeepL está configurado', async () => {
  process.env.DEEPL_AUTH_KEY = 'integration-key:fx';
  delete process.env.DEEPL_API_URL;
  global.fetch = async (url, options) => {
    const parsed = new URL(url);
    if (parsed.hostname === 'openlibrary.org') {
      if (parsed.pathname === '/works/OL100W.json') {
        return respostaJson(obra({
          title: 'The Hidden Library',
          description: 'A student discovers a hidden library.',
          subjects: ['Magical realism'],
        }));
      }
      if (parsed.pathname === '/authors/OL1A.json') return respostaJson({ name: 'Machado de Assis' });
      return respostaJson({ error: 'not found' }, 404);
    }

    assert.equal(parsed.href, 'https://api-free.deepl.com/v2/translate');
    assert.deepEqual(JSON.parse(options.body), {
      text: ['The Hidden Library', 'A student discovers a hidden library.', 'Magical realism'],
      target_lang: 'PT-BR',
    });
    return respostaJson({
      translations: [
        { detected_source_language: 'EN', text: 'Um estudante descobre uma biblioteca escondida' },
        { detected_source_language: 'EN', text: 'Um estudante descobre uma biblioteca secreta.' },
        { detected_source_language: 'EN', text: 'Realismo mágico' },
      ],
    });
  };

  const res = await detalhar('OL100W');

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.book.title, 'Um estudante descobre uma biblioteca escondida');
  assert.equal(res.body.book.titleTranslated, true);
  assert.equal(res.body.book.originalTitle, 'The Hidden Library');
  assert.equal(res.body.book.description, 'Um estudante descobre uma biblioteca secreta.');
  assert.equal(res.body.book.descriptionTranslated, true);
  assert.deepEqual(res.body.book.categories, ['Realismo mágico']);
  assert.equal(res.body.book.categoriesTranslated, true);
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
