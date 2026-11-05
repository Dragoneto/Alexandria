const assert = require('node:assert/strict');
const { test } = require('node:test');
const harness = require('./helpers/biblioteca-status.cjs');

test('bloqueia trocas simultaneas do mesmo livro, mas permite outro livro', async () => {
  const h = harness();
  const change = h.render();
  const first = change(1, 'LENDO');
  await change(1, 'LIDO');
  await h.render()(1, 'ABANDONADO');
  assert.equal(h.requests.length, 1);
  assert.deepEqual(h.saving, [1]);
  const secondBook = h.render()(2, 'LIDO');
  assert.equal(h.requests.length, 2);
  h.requests[1].resolve({});
  await secondBook;
  h.requests[0].resolve({});
  await first;
  assert.deepEqual(h.items.map((item) => item.statusLeitura), ['LENDO', 'LIDO']);
  assert.deepEqual(h.saving, []);
});

test('avisa quando o status foi salvo', async () => {
  const h = harness();
  const mudanca = h.render()(1, 'LENDO');
  h.requests[0].resolve({});
  await mudanca;
  assert.deepEqual(h.avisos, ['Status alterado para Lendo']);
});

test('não avisa sucesso quando o status falha', async () => {
  const h = harness();
  const mudanca = h.render()(1, 'LENDO');
  h.requests[0].reject(new Error('Sem conexao'));
  await mudanca;
  assert.deepEqual(h.avisos, []);
  assert.equal(h.alerts.length, 1);
});

test('falha restaura o status e libera uma nova tentativa', async () => {
  const h = harness();
  const first = h.render()(1, 'LENDO');
  await h.render()(1, 'LIDO');
  assert.equal(h.requests.length, 1);
  h.requests[0].reject(new Error('Sem conexao'));
  await first;
  assert.equal(h.items[0].statusLeitura, 'QUERO_LER');
  assert.equal(h.alerts.length, 1);
  assert.deepEqual(h.saving, []);
  const retry = h.render()(1, 'LIDO');
  assert.equal(h.requests.length, 2);
  h.requests[1].resolve({});
  await retry;
  assert.equal(h.items[0].statusLeitura, 'LIDO');
  assert.deepEqual(h.saving, []);
  await h.render()(1, 'LIDO');
  assert.equal(h.requests.length, 2);
});
