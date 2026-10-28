const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alexandria-avaliacoes-'));

process.env.NODE_ENV = 'test';
process.env.DB_MODE = 'local';
process.env.LOCAL_DB_FILE = path.join(dataDir, 'users.json');
process.env.LOCAL_REVIEWS_FILE = path.join(dataDir, 'avaliacoes.json');
process.env.LOCAL_COMMENTS_FILE = path.join(dataDir, 'comentarios.json');
process.env.JWT_SECRET = 'segredo-de-teste';

const assert = require('node:assert/strict');
const { after, afterEach, before, test } = require('node:test');

const { create, detail, listByBook, listMine, remove, update } = require('../src/controllers/avaliacaoController');
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
    if (typeof resposta === 'function') return resposta(url);
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

async function chamar(handler, { usuario = leitora, body, params, query } = {}) {
  const res = fakeResponse();
  await handler({ user: { id: usuario.id }, body, params, query }, res);
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

test('lista as avaliações do livro com quem avaliou, total, média e a minha primeiro', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.now() }); // mesmo criado_em: o id desempata
  const terceira = await users.create({ nome: 'Terceira', email: 'terceira@alexandria.com', senhaHash: 'x' });
  await users.updatePhoto(leitora.id, `data:image/png;base64,${'A'.repeat(100)}`);
  const livro = { id: 'OL700W', titulo: 'Quincas Borba', autores: ['Machado de Assis'], capa: null };
  for (const [usuario, nota] of [[leitora, 5], [leitor, 5], [terceira, 4]]) {
    await avaliacoes.create({ userId: usuario.id, livro, nota, resenha: RESENHA });
  }
  global.fetch = async () => assert.fail('a leitura não chama a Open Library');

  const res = await chamar(listByBook, { usuario: leitor, params: { livroId: 'OL700W' } });
  const { avaliacoes: lista, ...resumo } = res.body;
  assert.deepEqual(resumo, { total: 3, media: 4.7, page: 1, limit: 10, hasMore: false });
  assert.deepEqual(lista.map((a) => [a.usuarioNome, a.minha]), [['Leitor', true], ['Terceira', false], ['Leitora', false]]);
  assert.doesNotMatch(JSON.stringify(res.body), /@alexandria|base64|senha_hash/);
});

test('pagina a lista do livro sem mudar o total e a média', async () => {
  const pagina = async (page) =>
    (await chamar(listByBook, { usuario: leitor, params: { livroId: 'OL700W' }, query: { page, limit: '1' } })).body;
  const paginas = [await pagina('1'), await pagina('2'), await pagina('3')];

  assert.deepEqual(paginas.map((p) => p.avaliacoes.map((a) => a.usuarioNome)), [['Leitor'], ['Terceira'], ['Leitora']]);
  assert.deepEqual(paginas.map((p) => p.hasMore), [true, true, false]);
  assert.ok(paginas.every((p) => p.total === 3 && p.media === 4.7));
  assert.equal((await chamar(listByBook, { params: { livroId: ' OL700W ' }, query: { limit: '50' } })).body.limit, 20);

  for (const query of [{ page: '0' }, { limit: 'abc' }, { page: '-1' }, { page: ['1', '2'] }]) {
    assert.match((await chamar(listByBook, { params: { livroId: 'OL700W' }, query })).body.error, /inteiros positivos/);
  }
});

test('livro sem avaliações tem total 0 e média nula; id de livro inválido dá 400', async () => {
  const vazio = await chamar(listByBook, { params: { livroId: 'OL999W' } });
  assert.deepEqual(vazio.body, { avaliacoes: [], total: 0, media: null, page: 1, limit: 10, hasMore: false });

  for (const livroId of ['dom-casmurro', 'ol700w', 'OL1M']) {
    assert.match((await chamar(listByBook, { params: { livroId } })).body.error, /livro inválido/);
  }
});

test('lista só as minhas avaliações, das mais recentes para as mais antigas', async () => {
  const velha = await avaliacoes.findByUserAndBook(leitor.id, 'OL200W');
  await avaliacoes.update(velha.id, leitor.id, { nota: 2, resenha: RESENHA }); // editar não muda a posição
  const res = await chamar(listMine, { usuario: leitor });
  assert.deepEqual(res.body.avaliacoes.map((a) => a.livro.id), ['OL700W', 'OL400W', 'OL500W', 'OL200W']);
  assert.ok(res.body.avaliacoes.every((a) => a.usuarioId === leitor.id && a.minha && a.usuarioNome === 'Leitor'));

  const novo = await users.create({ nome: 'Novo', email: 'novo@alexandria.com', senhaHash: 'x' });
  assert.deepEqual((await chamar(listMine, { usuario: novo })).body, { avaliacoes: [] });
});

test('qualquer leitor vê uma avaliação pelo id, e minha só vale para o dono', async () => {
  const { id } = await avaliacoes.findByUserAndBook(leitora.id, 'OL700W');
  const params = { id: String(id) };

  const { avaliacao: deOutro } = (await chamar(detail, { usuario: leitor, params })).body;
  assert.deepEqual([deOutro.usuarioNome, deOutro.minha], ['Leitora', false]);
  assert.equal((await chamar(detail, { usuario: leitora, params })).body.avaliacao.minha, true);

  assert.equal((await chamar(detail, { params: { id: '999999' } })).statusCode, 404);
  for (const invalido of ['abc', '-1', '1.5', 'minhas']) {
    assert.equal((await chamar(detail, { params: { id: invalido } })).statusCode, 400);
  }
});

test('as rotas fixas vêm antes de /:id', () => {
  const rotasGet = require('../src/routes/avaliacoes').stack.filter((c) => c.route?.methods.get);
  assert.deepEqual(rotasGet.map((c) => c.route.path), ['/minhas', '/livro/:livroId', '/:id']);
});

test('avaliar pelo id unificado grava o destino, e tentar de novo pelo id antigo devolve a existente', async () => {
  const pessoa = await users.create({ nome: 'Unificada', email: 'unificada@alexandria.com', senhaHash: 'x' });
  simularOpenLibrary({
    '/works/OL801W.json': { key: '/works/OL801W', type: { key: '/type/redirect' }, location: '/works/OL800W' },
    '/works/OL800W.json': { key: '/works/OL800W', title: 'Esaú e Jacó' },
    '/query.json': () => respostaJson({}, 503), // a consulta de unificados fora do ar não impede a criação
  });
  const body = { livroId: 'OL801W', nota: 4, resenha: RESENHA };

  const criada = await chamar(create, { usuario: pessoa, body });
  assert.equal(criada.body.avaliacao.livro.id, 'OL800W');

  const denovo = await chamar(create, { usuario: pessoa, body });
  assert.equal(denovo.statusCode, 409);
  assert.equal(denovo.body.avaliacaoId, criada.body.avaliacao.id);
});

test('livro unificado depois da avaliação: avaliar por outro id do mesmo livro devolve a avaliação antiga', async () => {
  const pessoa = await users.create({ nome: 'Antiga', email: 'antiga@alexandria.com', senhaHash: 'x' });
  simularOpenLibrary({ '/works/OL900W.json': { key: '/works/OL900W', title: 'Helena' } });
  const antiga = await chamar(create, { usuario: pessoa, body: { livroId: 'OL900W', nota: 3, resenha: RESENHA } });

  // A Open Library unificou OL900W e OL902W em OL901W, e a pessoa abre o livro pelo id antigo OL902W
  simularOpenLibrary({
    '/works/OL902W.json': { key: '/works/OL902W', type: { key: '/type/redirect' }, location: '/works/OL901W' },
    '/works/OL901W.json': { key: '/works/OL901W', title: 'Helena' },
    '/query.json': (url) => respostaJson(decodeURIComponent(url).includes('?type=/type/redirect&location=/works/OL901W&') ? [{ key: '/works/OL900W' }] : []),
  });
  const res = await chamar(create, { usuario: pessoa, body: { livroId: 'OL902W', nota: 5, resenha: RESENHA } });

  assert.equal(res.statusCode, 409);
  assert.equal(res.body.avaliacaoId, antiga.body.avaliacao.id);
});

test('erro do banco ao gravar continua 500, e não vira 409', async (t) => {
  simularOpenLibrary({ '/works/OL930W.json': { key: '/works/OL930W', title: 'Casa Velha' } });
  t.mock.method(avaliacoes, 'create', async () => Promise.reject(new Error('banco fora do ar')));
  t.mock.method(console, 'error', () => {});
  assert.equal((await chamar(create, { usuario: leitor, body: { livroId: 'OL930W', nota: 4, resenha: RESENHA } })).statusCode, 500);
});

test('toque duplo no enviar: uma avaliação só, e o segundo pedido recebe a que ficou', async () => {
  const pessoa = await users.create({ nome: 'Apressada', email: 'apressada@alexandria.com', senhaHash: 'x' });
  simularOpenLibrary({ '/works/OL920W.json': { key: '/works/OL920W', title: 'Ressurreição' } });
  const body = { livroId: 'OL920W', nota: 5, resenha: RESENHA };

  const respostas = await Promise.all([chamar(create, { usuario: pessoa, body }), chamar(create, { usuario: pessoa, body })]);
  const [criada, repetida] = respostas.sort((a, b) => a.statusCode - b.statusCode);

  assert.deepEqual([criada.statusCode, repetida.statusCode], [201, 409]);
  assert.equal(repetida.body.avaliacaoId, criada.body.avaliacao.id);
  assert.equal((await avaliacoes.findByUser(pessoa.id)).length, 1);
});
