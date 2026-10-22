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
