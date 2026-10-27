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
