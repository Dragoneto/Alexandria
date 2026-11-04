const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createServices, json, session } = require('./helpers/services.cjs');

async function logado() {
  const harness = createServices();
  await harness.session.saveAuth(session);
  return harness;
}

test('lista a biblioteca com filtro e token da sessão', async () => {
  const harness = await logado();
  const itens = [{ id: 2, statusLeitura: 'LENDO', favorito: false }];
  harness.fetch = async (url, options) => {
    assert.equal(url, 'http://localhost:3000/api/biblioteca?status=LENDO');
    assert.equal(options.headers.Authorization, `Bearer ${session.token}`);
    return json({ itens });
  };

  assert.deepEqual(await harness.biblioteca.listarBiblioteca(undefined, 'LENDO'), itens);
});

test('atualiza status e favorito pelo endpoint da biblioteca', async () => {
  const harness = await logado();
  const item = { id: 2, statusLeitura: 'LIDO', favorito: true };
  harness.fetch = async (url, options) => {
    assert.equal(url, 'http://localhost:3000/api/biblioteca/2');
    assert.equal(options.method, 'PATCH');
    assert.deepEqual(JSON.parse(options.body), { status: 'LIDO', favorito: true });
    return json({ item });
  };

  assert.deepEqual(
    await harness.biblioteca.atualizarItemBiblioteca(2, {
      status: 'LIDO',
      favorito: true,
    }),
    item,
  );
});

test('filtra a lista carregada combinando status e favoritos', () => {
  const { biblioteca } = createServices();
  const itens = [
    { id: 1, statusLeitura: 'LENDO', favorito: true },
    { id: 2, statusLeitura: 'LENDO', favorito: false },
    { id: 3, statusLeitura: 'LIDO', favorito: true },
    { id: 4, statusLeitura: 'QUERO_LER', favorito: false },
  ];
  const ids = (filtro) => biblioteca.filtrarBiblioteca(itens, filtro).map((item) => item.id);

  assert.deepEqual(ids(), [1, 2, 3, 4]);
  assert.deepEqual(ids({ status: null }), [1, 2, 3, 4]);
  assert.deepEqual(ids({ status: 'LENDO' }), [1, 2]);
  assert.deepEqual(ids({ somenteFavoritos: true }), [1, 3]);
  assert.deepEqual(ids({ status: 'LENDO', somenteFavoritos: true }), [1]);
  assert.deepEqual(ids({ status: 'QUERO_LER', somenteFavoritos: true }), []);
  assert.deepEqual(biblioteca.filtrarBiblioteca([], { somenteFavoritos: true }), []);
});
