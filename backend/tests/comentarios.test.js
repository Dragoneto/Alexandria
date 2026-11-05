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

const { create, list, remove, update } = require('../src/controllers/comentarioController');
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

test('idempotency key: a mesma key do mesmo usuário devolve o comentário já gravado, mesmo em gravações simultâneas', async () => {
  const outra = await avaliacoes.create({ userId: autora.id, livro: livro('OL707W'), nota: 4, resenha: RESENHA });
  const gravar = (userId, idempotencyKey) =>
    comentarios.create({ avaliacaoId: outra.id, userId, texto: 'kkkk', idempotencyKey, payloadHash: 'hash' });

  const juntos = await Promise.all([1, 2, 3].map(() => gravar(leitor.id, 'key-do-leitor-001')));
  assert.equal(new Set(juntos.map((c) => c.id)).size, 1);
  const salvo = await comentarios.findByIdempotencyKey(leitor.id, 'key-do-leitor-001');
  assert.deepEqual([salvo.id, salvo.payload_hash], [juntos[0].id, 'hash']);

  // A key é de cada usuário, e texto igual sem key é outra mensagem
  const daAutora = await gravar(autora.id, 'key-do-leitor-001');
  const semKey = [await gravar(leitor.id, null), await gravar(leitor.id, null)];
  assert.equal(new Set([juntos[0].id, daAutora.id, ...semKey.map((c) => c.id)]).size, 4);
  assert.equal((await comentarios.findByIdempotencyKey(autora.id, 'key-do-leitor-001')).id, daAutora.id);
  assert.equal(await comentarios.findByIdempotencyKey(autora.id, 'key-que-ninguem-usou'), null);
});

/** Resposta falsa do Express: guarda status e corpo para a asserção. */
async function chamar(handler, usuario, { params, body, headers } = {}) {
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
  await handler({ user: { id: usuario.id }, params, body, headers }, res);
  return res;
}

const naAvaliacao = (usuario, body) => chamar(create, usuario, { params: { id: String(avaliacao.id) }, body });

test('dois usuários: comenta na avaliação da outra pessoa, com o autor vindo só da sessão', async () => {
  await users.updatePhoto(leitor.id, `data:image/png;base64,${'A'.repeat(100)}`);
  const comExtras = await naAvaliacao(leitor, { texto: 'Oi', usuarioId: autora.id, avaliacaoId: 999 });
  assert.deepEqual([comExtras.statusCode, comExtras.body.error], [400, 'Campo fora do contrato: usuarioId, avaliacaoId']);
  assert.equal((await naAvaliacao(leitor, { texto: 'Oi', versao: 1 })).statusCode, 400); // versao é só da edição
  const res = await naAvaliacao(leitor, { texto: '  Também   achei o final corrido.  ' });

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
    versao: 1,
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

const noComentario = (handler, usuario, id, body) => chamar(handler, usuario, { params: { id: String(id) }, body });

test('edita só o próprio comentário, e a edição não muda autor, avaliação nem pai', async () => {
  const raiz = (await naAvaliacao(autora, { texto: 'Pergunta da autora' })).body.comentario;
  const resposta = (await naAvaliacao(leitor, { texto: 'Resposta do leitor', paiId: raiz.id })).body.comentario;

  assert.equal((await noComentario(update, autora, resposta.id, { texto: 'Invasão' })).statusCode, 403);
  assert.equal((await noComentario(update, leitor, resposta.id, { texto: '   ' })).statusCode, 400);
  assert.equal((await noComentario(update, leitor, 'abc', { texto: 'Oi' })).statusCode, 400);
  assert.equal((await noComentario(update, leitor, 999999, { texto: 'Oi' })).statusCode, 404);

  const comExtras = { texto: 'Mudando o pai', paiId: null, avaliacaoId: 999, usuarioId: autora.id, versao: 1 };
  const recusada = await noComentario(update, leitor, resposta.id, comExtras);
  assert.deepEqual([recusada.statusCode, recusada.body.error], [400, 'Campo fora do contrato: paiId, avaliacaoId, usuarioId']);
  const corpo = { texto: ' Resposta   corrigida ', versao: 1 };
  const { comentario } = (await noComentario(update, leitor, resposta.id, corpo)).body;
  assert.deepEqual(
    [comentario.texto, comentario.paiId, comentario.avaliacaoId, comentario.autor.id, comentario.versao],
    ['Resposta corrigida', raiz.id, avaliacao.id, leitor.id, 2],
  );
});

test('versão faltando ou inválida dá 400, mas quem não é o dono recebe 403 antes de conferir a versão', async () => {
  const meu = (await naAvaliacao(leitor, { texto: 'Para editar' })).body.comentario;
  for (const versao of [undefined, null, '1', 0, -1, 1.5, 1e10]) {
    const res = await noComentario(update, leitor, meu.id, { texto: 'Novo', versao });
    assert.deepEqual([res.statusCode, res.body.errors?.versao], [400, 'Versão do comentário inválida'], String(versao));
  }
  // A maior versão aceita passa na validação e só não confere
  assert.equal((await noComentario(update, leitor, meu.id, { texto: 'Novo', versao: 999999999 })).statusCode, 409);
  assert.equal((await noComentario(update, autora, meu.id, { texto: 'Invasão' })).statusCode, 403);
  assert.equal((await comentarios.findById(meu.id)).texto, 'Para editar');
});

test('excluir é soft delete: o texto some, as respostas continuam e o removido não aceita mais nada', async () => {
  const raiz = (await naAvaliacao(leitor, { texto: 'Vou apagar isto' })).body.comentario;
  const resposta = (await naAvaliacao(autora, { texto: 'Resposta que fica', paiId: raiz.id })).body.comentario;

  assert.equal((await noComentario(remove, autora, raiz.id)).statusCode, 403);
  const { comentario } = (await noComentario(remove, leitor, raiz.id)).body;
  assert.deepEqual(
    [comentario.removido, comentario.texto, comentario.podeEditar, comentario.podeExcluir],
    [true, null, false, false],
  );

  const lista = (await chamar(list, autora, { params: { id: String(avaliacao.id) } })).body.comentarios;
  assert.equal(lista.find((c) => c.id === raiz.id).removido, true);
  assert.equal(lista.find((c) => c.id === resposta.id).texto, 'Resposta que fica');

  assert.equal((await noComentario(remove, leitor, raiz.id)).statusCode, 409);
  assert.equal((await noComentario(update, leitor, raiz.id, { texto: 'Voltei', versao: 1 })).statusCode, 409);
  assert.equal((await naAvaliacao(autora, { texto: 'Oi', paiId: raiz.id })).statusCode, 409);
  assert.ok(!fs.readFileSync(process.env.LOCAL_COMMENTS_FILE, 'utf8').includes('Vou apagar isto'));
});

test('mudança entre a checagem e a gravação: removido no meio dá 409, avaliação apagada no meio dá 404', async (t) => {
  const efemera = await avaliacoes.create({ userId: leitor.id, livro: livro('OL706W'), nota: 3, resenha: RESENHA });
  const comentar = async (texto) =>
    (await chamar(create, leitor, { params: { id: String(efemera.id) }, body: { texto } })).body.comentario;
  const [primeiro, segundo] = [await comentar('Primeiro'), await comentar('Segundo')];
  const { update: editar, remove: apagar } = comentarios;

  t.mock.method(comentarios, 'update', async (...args) => {
    await apagar(primeiro.id, leitor.id); // removido em outra aba antes de gravar
    return editar(...args);
  });
  assert.equal((await noComentario(update, leitor, primeiro.id, { texto: 'Editado', versao: 1 })).statusCode, 409);

  t.mock.method(comentarios, 'remove', async (...args) => {
    await avaliacoes.remove(efemera.id, leitor.id); // a avaliação some antes de gravar
    return apagar(...args);
  });
  assert.equal((await noComentario(remove, leitor, segundo.id)).statusCode, 404);
});

test('editar e excluir ficam no router de comentários, atrás do login', () => {
  const { stack } = require('../src/routes/comentarios');
  assert.equal(stack[0].handle, require('../src/middlewares/authMiddleware'));
  assert.deepEqual(
    stack.filter((c) => c.route).map((c) => [Object.keys(c.route.methods)[0], c.route.path]),
    [['put', '/:id'], ['delete', '/:id']],
  );
});

const comKey = (usuario, key, body, avaliacaoId) =>
  chamar(create, usuario, { params: { id: String(avaliacaoId) }, body, headers: { 'idempotency-key': key } });
const novaConversa = (livroId) =>
  avaliacoes.create({ userId: autora.id, livro: livro(livroId), nota: 4, resenha: RESENHA });

test('resposta perdida: o reenvio com a mesma Idempotency-Key devolve 201 com o mesmo comentário', async () => {
  const conversa = await novaConversa('OL708W');
  const raiz = (await comKey(autora, 'raiz-da-conversa-001', { texto: 'Gostaram?' }, conversa.id)).body.comentario;
  const resposta = { texto: 'Muito!', paiId: raiz.id };

  const perdida = await comKey(leitor, 'resposta-perdida-001', resposta, conversa.id); // não chegou ao app
  const reenvio = await comKey(leitor, 'resposta-perdida-001', { ...resposta, texto: '  Muito!  ' }, conversa.id);
  assert.deepEqual([perdida.statusCode, reenvio.statusCode], [201, 201]);
  assert.deepEqual(reenvio.body, perdida.body);

  // O pai removido depois não muda o resultado do reenvio, mas uma resposta nova a ele continua barrada
  await comentarios.remove(raiz.id, autora.id);
  const depois = await comKey(leitor, 'resposta-perdida-001', resposta, conversa.id);
  assert.deepEqual([depois.statusCode, depois.body.comentario.id], [201, perdida.body.comentario.id]);
  const nova = await comKey(leitor, 'resposta-ao-removido', resposta, conversa.id);
  assert.deepEqual([nova.statusCode, nova.body.error], [409, 'Este comentário foi removido']);

  // O reenvio devolve o comentário como ele está agora: removido, se a pessoa já o apagou
  await comentarios.remove(perdida.body.comentario.id, leitor.id);
  const aposApagar = await comKey(leitor, 'resposta-perdida-001', resposta, conversa.id);
  assert.deepEqual([aposApagar.statusCode, aposApagar.body.comentario.removido], [201, true]);
  assert.equal((await comentarios.findByAvaliacao(conversa.id)).length, 2);
});

test('a mesma Idempotency-Key com outra mensagem dá 409 e não grava nada', async () => {
  const [conversa, outra] = [await novaConversa('OL709W'), await novaConversa('OL710W')];
  const original = (await comKey(leitor, 'key-reaproveitada-01', { texto: 'Original' }, conversa.id)).body.comentario;

  const casos = [
    [{ texto: 'Outro texto' }, conversa.id],
    [{ texto: 'Original', paiId: original.id }, conversa.id],
    [{ texto: 'Original' }, outra.id],
  ];
  for (const [body, avaliacaoId] of casos) {
    const res = await comKey(leitor, 'key-reaproveitada-01', body, avaliacaoId);
    assert.deepEqual([res.statusCode, res.body.error], [409, 'Idempotency-Key já usada em outra mensagem']);
  }
  assert.equal((await comentarios.findByAvaliacao(conversa.id)).length, 1);
  assert.deepEqual(await comentarios.findByAvaliacao(outra.id), []);
});

test('envios simultâneos com a mesma Idempotency-Key gravam um comentário só', async (t) => {
  const conversa = await novaConversa('OL711W');
  const enviar = (usuario, key) => comKey(usuario, key, { texto: 'Cliquei duas vezes' }, conversa.id);

  const juntos = await Promise.all([1, 2, 3].map(() => enviar(leitor, 'toque-duplo-00001')));
  assert.deepEqual(juntos.map((r) => r.statusCode), [201, 201, 201]);
  assert.equal(new Set(juntos.map((r) => r.body.comentario.id)).size, 1);

  // Todos passam pela busca antes de qualquer gravação: quem segura é a gravação, e outra mensagem leva 409
  t.mock.method(comentarios, 'findByIdempotencyKey', async () => null);
  const corrida = await Promise.all([1, 2].map(() => enviar(autora, 'toque-duplo-00002')));
  assert.equal(corrida[0].body.comentario.id, corrida[1].body.comentario.id);
  const outra = await Promise.all([
    enviar(leitor, 'toque-duplo-00003'),
    comKey(leitor, 'toque-duplo-00003', { texto: 'Outro texto' }, conversa.id),
  ]);
  assert.deepEqual(outra.map((r) => r.statusCode).sort(), [201, 409]);
  assert.equal((await comentarios.findByAvaliacao(conversa.id)).length, 3);
});

test('a Idempotency-Key é de cada usuário, e a mesma mensagem com outra key ou sem key é outro comentário', async () => {
  const conversa = await novaConversa('OL712W');
  const envios = [
    [leitor, 'mesma-key-dos-dois'],
    [autora, 'mesma-key-dos-dois'],
    [leitor, 'outra-key-do-leitor'],
    [leitor, undefined],
    [leitor, undefined],
  ];
  const ids = [];
  for (const [usuario, key] of envios) {
    const res = await comKey(usuario, key, { texto: 'kkkk' }, conversa.id);
    assert.deepEqual([res.statusCode, res.body.comentario.autor.id], [201, usuario.id]);
    ids.push(res.body.comentario.id);
  }
  assert.equal(new Set(ids).size, envios.length);
  for (const id of ids.slice(3)) assert.equal((await comentarios.findById(id)).payload_hash, null); // sem key, sem hash
});

test('Idempotency-Key fora do formato dá 400 sem gravar, e um UUID serve', async () => {
  const conversa = await novaConversa('OL713W');
  for (const key of ['', 'curta-demais', 'a'.repeat(101), 'tem espaco no meio', 'acentuação-não-vale', 'key-0001, key-0002']) {
    const res = await comKey(leitor, key, { texto: 'Oi' }, conversa.id);
    assert.deepEqual([res.statusCode, res.body.error], [400, 'Idempotency-Key inválida']);
  }
  assert.deepEqual(await comentarios.findByAvaliacao(conversa.id), []);

  for (const key of [require('node:crypto').randomUUID(), 'a'.repeat(16), 'A_b-'.repeat(25)]) {
    assert.equal((await comKey(leitor, key, { texto: key }, conversa.id)).statusCode, 201);
  }
});

test('retention: depois de 24 horas a Idempotency-Key é esquecida, e o comentário continua', async (t) => {
  const conversa = await novaConversa('OL714W');
  const enviar = () => comKey(leitor, 'key-de-ontem-00001', { texto: 'Bom dia' }, conversa.id);
  t.mock.timers.enable({ apis: ['Date'], now: Date.now() });
  const primeiro = (await enviar()).body.comentario;

  t.mock.timers.tick(24 * 60 * 60 * 1000); // ainda vale
  assert.equal((await enviar()).body.comentario.id, primeiro.id);

  // Venceu: a limpeza ao mesmo tempo que outra gravação não perde nenhuma das duas
  t.mock.timers.tick(1);
  const [, junto] = await Promise.all([
    comentarios.expireIdempotencyKeys(),
    comentarios.create({ avaliacaoId: conversa.id, userId: autora.id, texto: 'Junto da limpeza' }),
  ]);
  const antigo = await comentarios.findById(primeiro.id);
  assert.deepEqual([antigo.texto, antigo.idempotency_key, antigo.payload_hash], ['Bom dia', null, null]);
  assert.ok(await comentarios.findById(junto.id));

  // E a mesma key, já esquecida, grava outro comentário
  assert.notEqual((await enviar()).body.comentario.id, primeiro.id);
});

test('corpo acima de 32 KB dá 413 ao comentar e ao editar, e o maior comentário válido passa', async () => {
  const conversa = await novaConversa('OL720W');
  const naConversa = (body) => chamar(create, leitor, { params: { id: String(conversa.id) }, body });
  const enorme = 'a'.repeat(33 * 1024);

  const recusado = await naConversa({ texto: enorme });
  assert.deepEqual([recusado.statusCode, recusado.body], [413, { error: 'O corpo da requisição passou de 32 KB' }]);
  const valido = (await naConversa({ texto: '😀'.repeat(2000) })).body.comentario; // 2.000 caracteres de 4 bytes
  assert.equal([...valido.texto].length, 2000);

  assert.equal((await noComentario(update, leitor, valido.id, { texto: enorme, versao: 1 })).statusCode, 413);

  // Mede em bytes, vale o limite exato, e responde antes de procurar a avaliação
  assert.equal((await naConversa({ texto: 'a'.repeat(32 * 1024 - 12) })).statusCode, 400); // 32 KB exatos: só o texto passa do limite
  assert.equal((await naConversa({ texto: '😀'.repeat(9000) })).statusCode, 413); // 36 KB, mas 18 mil unidades UTF-16
  assert.equal((await chamar(create, leitor, { params: { id: '999999' }, body: { texto: enorme } })).statusCode, 413);

  // Com Content-Length vale o tamanho enviado; corpo que nem serializa é grande demais, e não um erro 500
  const enviado = { params: { id: String(conversa.id) }, body: { texto: 'Oi' }, headers: { 'content-length': String(40 * 1024) } };
  assert.equal((await chamar(create, leitor, enviado)).statusCode, 413);
  const aninhado = JSON.parse(`{"texto":${'['.repeat(5000)}${']'.repeat(5000)}}`);
  assert.equal((await naConversa(aninhado)).statusCode, 413);
  assert.equal((await noComentario(update, leitor, valido.id, { ...aninhado, versao: 1 })).statusCode, 413);
  assert.equal((await comentarios.findById(valido.id)).texto, valido.texto);
  assert.equal((await comentarios.findByAvaliacao(conversa.id)).length, 1);
});

test('o log de erro leva só o contexto e a mensagem do erro, nunca o texto nem o token', async (t) => {
  const conversa = await novaConversa('OL721W');
  const meu = (await chamar(create, leitor, { params: { id: String(conversa.id) }, body: { texto: 'Para editar' } })).body.comentario;
  const falhar = async () => {
    throw new Error('falha simulada no banco');
  };
  t.mock.method(comentarios, 'create', falhar);
  t.mock.method(comentarios, 'update', falhar);
  const logs = [];
  for (const nivel of ['error', 'warn', 'log']) t.mock.method(console, nivel, (...partes) => logs.push(partes.join(' ')));

  const headers = { authorization: 'Bearer token-que-nao-pode-aparecer' };
  const comentando = await chamar(create, leitor, {
    params: { id: String(conversa.id) },
    body: { texto: 'Texto completo que não pode aparecer no log' },
    headers,
  });
  const editando = await chamar(update, leitor, {
    params: { id: String(meu.id) },
    body: { texto: 'Edição que não pode aparecer no log', versao: 1 },
    headers,
  });

  assert.deepEqual([comentando.statusCode, comentando.body], [500, { error: 'Erro interno do servidor' }]);
  assert.equal(editando.statusCode, 500);
  assert.deepEqual(logs, ['Erro ao comentar: falha simulada no banco', 'Erro ao editar comentário: falha simulada no banco']);
});
