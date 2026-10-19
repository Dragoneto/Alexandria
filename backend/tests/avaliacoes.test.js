const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alexandria-avaliacoes-'));

process.env.NODE_ENV = 'test';
process.env.DB_MODE = 'local';
process.env.LOCAL_DB_FILE = path.join(dataDir, 'users.json');
process.env.LOCAL_REVIEWS_FILE = path.join(dataDir, 'avaliacoes.json');
process.env.JWT_SECRET = 'segredo-de-teste';

const assert = require('node:assert/strict');
const { after, afterEach, before, test } = require('node:test');

const { create, remove, update } = require('../src/controllers/avaliacaoController');
const avaliacoes = require('../src/repositories/avaliacaoRepository');
const users = require('../src/repositories/userRepository');

const fetchOriginal = global.fetch;
let leitora;
let leitor;
let avaliacaoId;

function respostaJson(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function simularOpenLibrary(respostas) {
  global.fetch = async (url) => {
    const resposta = respostas[new URL(url).pathname];
    if (typeof resposta === 'function') return resposta();
    return resposta === undefined ? respostaJson({ error: 'notfound' }, 404) : respostaJson(resposta);
  };
}

const OPEN_LIBRARY = {
  '/works/OL100W.json': {
    key: '/works/OL100W',
    title: 'Dom Casmurro',
    covers: [12345],
    authors: [{ author: { key: '/authors/OL1A' } }],
  },
  '/authors/OL1A.json': { name: 'Machado de Assis' },
};

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

async function chamar(handler, { usuario = leitora, body, params } = {}) {
  const res = fakeResponse();
  await handler({ user: { id: usuario.id }, body, params }, res);
  return res;
}

before(async () => {
  await users.initialize();
  await avaliacoes.initialize();
  leitora = await users.create({ nome: 'Leitora', email: 'leitora@alexandria.com', senhaHash: 'x' });
  leitor = await users.create({ nome: 'Leitor', email: 'leitor@alexandria.com', senhaHash: 'x' });
});

afterEach(() => {
  global.fetch = fetchOriginal;
});

after(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('cria a avaliação com o usuário do token e os dados do livro', async () => {
  simularOpenLibrary(OPEN_LIBRARY);
  const res = await chamar(create, {
    body: { livroId: 'OL100W', nota: 5, resenha: '  Um clássico.  ', usuarioId: leitor.id },
  });

  assert.equal(res.statusCode, 201);
  const { avaliacao } = res.body;
  avaliacaoId = avaliacao.id;
  assert.equal(avaliacao.usuarioId, leitora.id);
  assert.equal(avaliacao.livro.titulo, 'Dom Casmurro');
  assert.deepEqual(avaliacao.livro.autores, ['Machado de Assis']);
  assert.equal(avaliacao.nota, 5);
  assert.equal(avaliacao.resenha, 'Um clássico.');
});

test('recusa livro, nota e resenha inválidos', async () => {
  const casos = [
    [{ livroId: 'dom-casmurro', nota: 4 }, /livro inválido/],
    ...[0, 6, 3.5, '5', undefined].map((nota) => [{ livroId: 'OL100W', nota }, /inteiro de 1 a 5/]),
    [{ livroId: 'OL100W', nota: 4, resenha: 42 }, /deve ser um texto/],
    [{ livroId: 'OL100W', nota: 4, resenha: 'a'.repeat(5001) }, /no máximo 5000/],
  ];

  for (const [body, mensagem] of casos) {
    const res = await chamar(create, { usuario: leitor, body });
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, mensagem);
  }
});

test('só permite uma avaliação por livro e devolve a existente', async () => {
  const res = await chamar(create, { body: { livroId: 'OL100W', nota: 3 } });

  assert.equal(res.statusCode, 409);
  assert.match(res.body.error, /já avaliou este livro/);
  assert.equal(res.body.avaliacaoId, avaliacaoId);
});

test('livro inexistente responde 404 e Open Library fora do ar responde 502', async () => {
  simularOpenLibrary(OPEN_LIBRARY);
  assert.equal((await chamar(create, { body: { livroId: 'OL999W', nota: 4 } })).statusCode, 404);

  simularOpenLibrary({ '/works/OL200W.json': () => respostaJson({}, 503) });
  assert.equal((await chamar(create, { body: { livroId: 'OL200W', nota: 4 } })).statusCode, 502);
});

test('outro usuário não edita nem exclui a avaliação', async () => {
  const params = { id: String(avaliacaoId) };

  assert.equal((await chamar(update, { usuario: leitor, params, body: { nota: 1 } })).statusCode, 403);
  assert.equal((await chamar(remove, { usuario: leitor, params })).statusCode, 403);
});

test('o dono edita e depois exclui a própria avaliação', async () => {
  const params = { id: String(avaliacaoId) };

  assert.equal((await chamar(update, { params, body: { nota: 9 } })).statusCode, 400);

  const editada = await chamar(update, { params, body: { nota: 4, resenha: 'Mudei de ideia.' } });
  assert.equal(editada.statusCode, 200);
  assert.equal(editada.body.avaliacao.nota, 4);
  assert.equal(editada.body.avaliacao.resenha, 'Mudei de ideia.');

  assert.equal((await chamar(remove, { params })).statusCode, 200);
  assert.equal((await chamar(remove, { params })).statusCode, 404);
});

test('identificador de avaliação inválido responde 400', async () => {
  for (const id of ['abc', '-1', '1.5']) {
    assert.equal((await chamar(update, { params: { id }, body: { nota: 3 } })).statusCode, 400);
    assert.equal((await chamar(remove, { params: { id } })).statusCode, 400);
  }
});
