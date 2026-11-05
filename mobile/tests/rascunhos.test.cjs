const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createServices, json, session, user } = require('./helpers/services.cjs');

const ALVO = { usuarioId: user.id, avaliacaoId: 3 };
const RESPOSTA = { ...ALVO, paiId: 8 };
const OUTRA_CONTA = { ...ALVO, usuarioId: 99 };

const chaves = (h) =>
  [...h.storage.keys()].filter((chave) => chave.startsWith('alexandria_rascunho:'));

async function logado(opcoes) {
  const h = createServices(opcoes);
  await h.session.saveAuth(session);
  return h;
}

test('sobrevive ao reinício, separado por conta, avaliação e comentário respondido', async () => {
  const storage = new Map();
  const antes = (await logado({ storage })).rascunhos;
  await antes.salvarRascunho(ALVO, '  Texto com espaços  ');
  await antes.salvarRascunho(RESPOSTA, 'Minha resposta');

  const { lerRascunho, listarRascunhosDaAvaliacao } = createServices({ storage }).rascunhos;

  assert.equal(await lerRascunho(ALVO), '  Texto com espaços  ');
  assert.equal(await lerRascunho(RESPOSTA), 'Minha resposta');
  assert.equal(await lerRascunho({ ...ALVO, avaliacaoId: 4 }), null);
  assert.equal(await lerRascunho(OUTRA_CONTA), null);
  assert.deepEqual(await listarRascunhosDaAvaliacao(user.id, 3), [
    { paiId: null, texto: '  Texto com espaços  ' },
    { paiId: 8, texto: 'Minha resposta' },
  ]);
});

test('não grava rascunho para uma conta que não é a da sessão, como depois de sair', async () => {
  const h = await logado();
  await h.auth.logoutUser();

  await h.rascunhos.salvarRascunho(ALVO, 'Digitado antes de sair');
  await (await logado()).rascunhos.salvarRascunho(OUTRA_CONTA, 'De outra conta');

  assert.deepEqual(chaves(h), []);
});

test('descartar apaga só o rascunho do alvo, e apagar todo o texto também', async () => {
  const h = await logado();
  await h.rascunhos.salvarRascunho(ALVO, 'Comentário');
  await h.rascunhos.salvarRascunho(RESPOSTA, 'Resposta');

  await h.rascunhos.descartarRascunho(ALVO);
  assert.equal(await h.rascunhos.lerRascunho(ALVO), null);
  assert.equal(await h.rascunhos.lerRascunho(RESPOSTA), 'Resposta');

  await h.rascunhos.salvarRascunho(RESPOSTA, '   ');
  assert.deepEqual(chaves(h), []);
});

test('rascunho vencido ou corrompido não aparece e sai do aparelho', async (t) => {
  const h = await logado();
  await h.rascunhos.salvarRascunho(ALVO, 'Quase vencendo');
  const inicio = Date.now();

  t.mock.method(Date, 'now', () => inicio + h.rascunhos.VALIDADE_RASCUNHO_MS - 1000);
  assert.equal(await h.rascunhos.lerRascunho(ALVO), 'Quase vencendo');

  t.mock.method(Date, 'now', () => inicio + h.rascunhos.VALIDADE_RASCUNHO_MS + 1000);
  assert.equal(await h.rascunhos.lerRascunho(ALVO), null);
  assert.deepEqual(chaves(h), []);

  h.storage.set(`alexandria_rascunho:${user.id}:3:raiz`, '{quebrado');
  assert.equal(await h.rascunhos.lerRascunho(ALVO), null);
  assert.deepEqual(chaves(h), []);
});

test('sair da conta apaga os rascunhos, mesmo se a limpeza falhar a sessão sai', async () => {
  const h = createServices();
  await h.session.saveAuth(session);
  await h.rascunhos.salvarRascunho(ALVO, 'Texto privado');

  await h.auth.logoutUser();
  assert.deepEqual(chaves(h), []);
  assert.equal(await h.session.getAuth(), null);

  await h.session.saveAuth(session);
  h.asyncStorage.getAllKeys = async () => {
    throw new Error('Falhou');
  };
  await h.auth.logoutUser();
  assert.equal(await h.session.getAuth(), null);
});

test('entrar apaga rascunhos de outra conta e mantém os da própria, como após sessão expirada', async () => {
  const h = await logado();
  await h.rascunhos.salvarRascunho(ALVO, 'Meu texto');
  h.storage.set(
    'alexandria_rascunho:99:3:raiz',
    JSON.stringify({ texto: 'Texto de outra pessoa', salvoEm: Date.now() }),
  );
  h.fetch = async () => json({ user, token: session.token });

  await h.auth.loginUser(user.email, 'senha1234');

  assert.equal(await h.rascunhos.lerRascunho(ALVO), 'Meu texto');
  assert.deepEqual(chaves(h), [`alexandria_rascunho:${user.id}:3:raiz`]);
});
