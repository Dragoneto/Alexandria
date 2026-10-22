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
