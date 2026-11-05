// As variáveis precisam existir antes dos require: os módulos leem o ambiente ao carregar.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alexandria-comentarios-'));

process.env.DB_MODE = 'local';
process.env.LOCAL_DB_FILE = path.join(dataDir, 'users.json');
process.env.LOCAL_REVIEWS_FILE = path.join(dataDir, 'avaliacoes.json');
process.env.LOCAL_COMMENTS_FILE = path.join(dataDir, 'comentarios.json');

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');

const { create, list } = require('../src/controllers/comentarioController');
const avaliacoes = require('../src/repositories/avaliacaoRepository');
const comentarios = require('../src/repositories/comentarioRepository');
const users = require('../src/repositories/userRepository');

const RESENHA = 'Leitura muito boa.';
const livro = (id) => ({ id, titulo: 'Quincas Borba', autores: ['Machado de Assis'], capa: null });
let autora;
let leitor;
let avaliacao;

before(async () => {
  await users.initialize();
  await avaliacoes.initialize();
  await comentarios.initialize();
  autora = await users.create({ nome: 'Autora', email: 'autora@alexandria.com', senhaHash: 'x' });
  leitor = await users.create({ nome: 'Leitor', email: 'leitor@alexandria.com', senhaHash: 'x' });
  avaliacao = await avaliacoes.create({ userId: autora.id, livro: livro('OL700W'), nota: 4, resenha: RESENHA });
});

after(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('grava comentário e resposta, e lista só os da avaliação, em ordem de criação', async () => {
  const outra = await avaliacoes.create({ userId: leitor.id, livro: livro('OL701W'), nota: 3, resenha: RESENHA });
  const raiz = await comentarios.create({ avaliacaoId: avaliacao.id, userId: leitor.id, texto: 'Também achei.' });
  await comentarios.create({ avaliacaoId: outra.id, userId: autora.id, texto: 'De outra avaliação.' });
  const resposta = await comentarios.create({
    avaliacaoId: avaliacao.id,
    userId: autora.id,
    paiId: raiz.id,
    texto: 'Obrigada!',
  });

  assert.deepEqual(
    (await comentarios.findByAvaliacao(avaliacao.id)).map((c) => [c.id, c.pai_id, c.user_id, c.texto, c.apagado_em]),
    [
      [raiz.id, null, leitor.id, 'Também achei.', null],
      [resposta.id, raiz.id, autora.id, 'Obrigada!', null],
    ],
  );
  assert.equal((await comentarios.findById(resposta.id)).avaliacao_id, avaliacao.id);
  assert.equal(await comentarios.findById(999999), null);
});

test('apagar a avaliação leva os comentários dela, e a nova que herdar o id começa vazia', async () => {
  const efemera = await avaliacoes.create({ userId: leitor.id, livro: livro('OL702W'), nota: 5, resenha: RESENHA });
  await comentarios.create({ avaliacaoId: efemera.id, userId: autora.id, texto: 'Vai sumir junto.' });

  assert.equal(await avaliacoes.remove(efemera.id, leitor.id), true);
  assert.deepEqual(await comentarios.findByAvaliacao(efemera.id), []);

  // No arquivo, o id da avaliação é o maior + 1: a próxima reaproveita o id da que foi apagada
  const nova = await avaliacoes.create({ userId: leitor.id, livro: livro('OL703W'), nota: 2, resenha: RESENHA });
  assert.equal(nova.id, efemera.id);
  assert.deepEqual(await comentarios.findByAvaliacao(nova.id), []);
  assert.equal((await comentarios.findByAvaliacao(avaliacao.id)).length, 2);
});

/** Resposta falsa do Express: guarda status e corpo para a asserção. */
async function chamar(handler, usuario, { params, body } = {}) {
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(corpo) {
      this.body = corpo;
      return this;
    },
  };
  await handler({ user: { id: usuario.id }, params, body }, res);
  return res;
}

const naAvaliacao = (usuario, body) => chamar(create, usuario, { params: { id: String(avaliacao.id) }, body });

test('dois usuários: comenta na avaliação da outra pessoa, com o autor vindo só da sessão', async () => {
  await users.updatePhoto(leitor.id, `data:image/png;base64,${'A'.repeat(100)}`);
  const res = await naAvaliacao(leitor, { texto: '  Também   achei o final corrido.  ', usuarioId: autora.id, avaliacaoId: 999 });

  assert.equal(res.statusCode, 201);
  const { comentario } = res.body;
  assert.deepEqual(comentario, {
    id: comentario.id,
    avaliacaoId: avaliacao.id,
    paiId: null,
    autor: { id: leitor.id, nome: 'Leitor' },
    texto: 'Também achei o final corrido.',
    removido: false,
    criadoEm: comentario.criadoEm,
    atualizadoEm: comentario.atualizadoEm,
    podeEditar: true,
    podeExcluir: true,
  });

  const daAutora = (await chamar(list, autora, { params: { id: String(avaliacao.id) } })).body.comentarios;
  const visto = daAutora.find((c) => c.id === comentario.id);
  assert.deepEqual([visto.podeEditar, visto.podeExcluir], [false, false]);
  assert.deepEqual(daAutora.map((c) => c.id), daAutora.map((c) => c.id).sort((a, b) => a - b));
  assert.doesNotMatch(JSON.stringify(daAutora), /@alexandria|base64|senha_hash/);
});

test('responde em vários níveis, e recusa pai de outra avaliação ou inválido', async () => {
  const raiz = (await naAvaliacao(autora, { texto: 'Obrigada pela leitura!' })).body.comentario;
  const resposta = (await naAvaliacao(leitor, { texto: 'De nada!', paiId: raiz.id })).body.comentario;
  const neta = (await naAvaliacao(autora, { texto: 'Volte sempre 😊', paiId: resposta.id })).body.comentario;
  assert.deepEqual([resposta.paiId, neta.paiId], [raiz.id, resposta.id]);

  const outra = await avaliacoes.create({ userId: leitor.id, livro: livro('OL704W'), nota: 4, resenha: RESENHA });
  const deFora = await comentarios.create({ avaliacaoId: outra.id, userId: leitor.id, texto: 'Em outra avaliação.' });
  for (const paiId of [deFora.id, 999999]) {
    assert.equal((await naAvaliacao(leitor, { texto: 'Oi', paiId })).statusCode, 404);
  }
  for (const paiId of ['1', 0, 1.5, -1, true, {}]) {
    assert.equal((await naAvaliacao(leitor, { texto: 'Oi', paiId })).statusCode, 400);
  }
});

test('valida o texto: obrigatório, tipo, só espaços ou invisíveis e limite de 2000 caracteres', async () => {
  for (const texto of ['kkkk', '👍', 'é'.repeat(2000)]) {
    assert.equal((await naAvaliacao(leitor, { texto })).statusCode, 201);
  }

  const casos = [
    [undefined, /obrigatório/],
    ['   ', /obrigatório/],
    ['\u200b\u200b\u200b', /obrigatório/],
    [42, /deve ser um texto/],
    ['a'.repeat(2001), /no máximo 2000/],
  ];
  for (const [texto, mensagem] of casos) {
    const res = await naAvaliacao(leitor, { texto });
    assert.equal(res.statusCode, 400);
    assert.match(res.body.errors.texto, mensagem);
    assert.equal(res.body.error, res.body.errors.texto);
  }
});

test('avaliação inexistente dá 404, e identificador inválido dá 400', async () => {
  for (const handler of [list, create]) {
    assert.equal((await chamar(handler, leitor, { params: { id: '999999' }, body: { texto: 'Oi' } })).statusCode, 404);
    for (const id of ['abc', '-1', '1.5']) {
      assert.equal((await chamar(handler, leitor, { params: { id }, body: { texto: 'Oi' } })).statusCode, 400);
    }
  }
});

test('avaliação apagada enquanto o comentário é gravado responde 404 sem deixar comentário órfão', async (t) => {
  const efemera = await avaliacoes.create({ userId: leitor.id, livro: livro('OL705W'), nota: 3, resenha: RESENHA });
  const gravar = comentarios.create;
  t.mock.method(comentarios, 'create', async (dados) => {
    await avaliacoes.remove(efemera.id, leitor.id); // a dona apaga a avaliação no meio do caminho
    return gravar(dados);
  });

  const res = await chamar(create, autora, { params: { id: String(efemera.id) }, body: { texto: 'Chegou tarde' } });
  assert.equal(res.statusCode, 404);
  assert.deepEqual(await comentarios.findByAvaliacao(efemera.id), []);
});
