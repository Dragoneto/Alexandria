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
const RESENHA = 'Leitura muito boa.';
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
    [{ livroId: 'dom-casmurro', nota: 4, resenha: RESENHA }, /livro inválido/],
    ...[0, 6, 3.5, '5'].map((nota) => [{ livroId: 'OL100W', nota, resenha: RESENHA }, /inteiro de 1 a 5/]),
    [{ livroId: 'OL100W', resenha: RESENHA }, /nota é obrigatória/],
    [{ livroId: 'OL100W', nota: 4, resenha: 42 }, /deve ser um texto/],
    [{ livroId: 'OL100W', nota: 4, resenha: 'a'.repeat(5001) }, /no máximo 5000/],
  ];

  for (const [body, mensagem] of casos) {
    const res = await chamar(create, { usuario: leitor, body });
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, mensagem);
  }
});

test('resenha é obrigatória, com pelo menos 10 caracteres e texto de verdade', async () => {
  const casos = [
    [undefined, /resenha é obrigatória/],
    ['   ', /resenha é obrigatória/],
    ['Gostei.', /pelo menos 10 caracteres/],
    ['  curta  a  ', /pelo menos 10 caracteres/],
    ['1234567890', /precisa ter palavras/],
    ['.......... !!!', /precisa ter palavras/],
    ['kkkkkkkkkkkk', /caractere repetido/],
    ['aaaaa aaaaa', /caractere repetido/],
  ];

  for (const [resenha, mensagem] of casos) {
    const res = await chamar(create, { usuario: leitor, body: { livroId: 'OL100W', nota: 4, resenha } });
    assert.equal(res.statusCode, 400, String(resenha));
    assert.match(res.body.errors.resenha, mensagem);
  }
});

test('devolve o erro de cada campo para a tela mostrar embaixo dele', async () => {
  const res = await chamar(create, { usuario: leitor, body: { livroId: 'OL100W', nota: 0, resenha: 'ok' } });

  assert.equal(res.statusCode, 400);
  assert.match(res.body.errors.nota, /inteiro de 1 a 5/);
  assert.match(res.body.errors.resenha, /pelo menos 10 caracteres/);
  assert.equal(res.body.error, res.body.errors.nota);
});

test('aceita resenha curta mas válida, com acentos e emoji', async () => {
  simularOpenLibrary({ ...OPEN_LIBRARY, '/works/OL200W.json': { key: '/works/OL200W', title: 'O Alienista' } });
  const res = await chamar(create, { usuario: leitor, body: { livroId: 'OL200W', nota: 3, resenha: ' Ótimo livro ✨ ' } });

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.avaliacao.resenha, 'Ótimo livro ✨');

  simularOpenLibrary({ '/works/OL500W.json': { key: '/works/OL500W', title: 'Só emoji' } });
  const emoji = await chamar(create, { usuario: leitor, body: { livroId: 'OL500W', nota: 5, resenha: '📚😍👏🔥✨🙌💯👍🤩📖' } });
  assert.equal(emoji.statusCode, 201);
});

test('limpa invisíveis, espaços e linhas em branco antes de contar e salvar', async () => {
  const recusadas = [`a${'​'.repeat(10)}`, `ok${'\u0007'.repeat(10)}`, 'a          b', `a${'\n'.repeat(20)}b`];
  for (const resenha of recusadas) {
    const res = await chamar(create, { usuario: leitor, body: { livroId: 'OL100W', nota: 4, resenha } });
    assert.match(res.body.errors?.resenha ?? '', /pelo menos 10 caracteres/, JSON.stringify(resenha));
  }

  simularOpenLibrary({ '/works/OL400W.json': { key: '/works/OL400W', title: 'Memórias' } });
  const resenha = 'Bom\u0000 livro,\t\tleitura   leve.\n\n\n\nRecomendo 👨‍👩‍👧 é nota';
  const res = await chamar(create, { usuario: leitor, body: { livroId: 'OL400W', nota: 4, resenha } });
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.avaliacao.resenha, 'Bom livro, leitura leve.\n\nRecomendo 👨‍👩‍👧 é nota');
});

test('quem já avaliou recebe o aviso antes da validação do texto', async () => {
  const res = await chamar(create, { body: { livroId: 'OL100W', nota: 0, resenha: 'ok' } });

  assert.equal(res.statusCode, 409);
  assert.equal(res.body.avaliacaoId, avaliacaoId);
});

test('só permite uma avaliação por livro e devolve a existente', async () => {
  const res = await chamar(create, { body: { livroId: 'OL100W', nota: 3, resenha: RESENHA } });

  assert.equal(res.statusCode, 409);
  assert.match(res.body.error, /já avaliou este livro/);
  assert.equal(res.body.avaliacaoId, avaliacaoId);
});

test('livro inexistente responde 404 e Open Library fora do ar responde 502', async () => {
  simularOpenLibrary(OPEN_LIBRARY);
  assert.equal((await chamar(create, { body: { livroId: 'OL999W', nota: 4, resenha: RESENHA } })).statusCode, 404);

  simularOpenLibrary({ '/works/OL300W.json': () => respostaJson({}, 503) });
  assert.equal((await chamar(create, { body: { livroId: 'OL300W', nota: 4, resenha: RESENHA } })).statusCode, 502);
});

test('outro usuário não edita nem exclui a avaliação', async () => {
  const params = { id: String(avaliacaoId) };

  const body = { nota: 1, resenha: RESENHA };
  assert.equal((await chamar(update, { usuario: leitor, params, body })).statusCode, 403);
  assert.equal((await chamar(remove, { usuario: leitor, params })).statusCode, 403);
});

test('o dono edita e depois exclui a própria avaliação', async () => {
  const params = { id: String(avaliacaoId) };

  assert.equal((await chamar(update, { params, body: { nota: 9, resenha: RESENHA } })).statusCode, 400);
  assert.equal((await chamar(update, { params, body: { nota: 4, resenha: 'aaaaaaaaaaaa' } })).statusCode, 400);

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
