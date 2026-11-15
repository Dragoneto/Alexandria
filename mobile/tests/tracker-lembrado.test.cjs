const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createServices, session } = require('./helpers/services.cjs');

test('lembra quantos livros estavam em Lendo, com teto para o esqueleto', async () => {
  const storage = new Map();
  const { biblioteca } = createServices({ storage });

  assert.equal(await biblioteca.livrosLendoLembrados(), null);
  await biblioteca.lembrarLivrosLendo(3);
  assert.equal(await createServices({ storage }).biblioteca.livrosLendoLembrados(), 3);
  await biblioteca.lembrarLivrosLendo(0);
  assert.equal(await biblioteca.livrosLendoLembrados(), 0);
  await biblioteca.lembrarLivrosLendo(40);
  assert.equal(await biblioteca.livrosLendoLembrados(), 6);
});

test('ignora valor estranho guardado no aparelho', async () => {
  const storage = new Map([['alexandria_tracker_lendo', 'abc']]);
  assert.equal(await createServices({ storage }).biblioteca.livrosLendoLembrados(), null);
});

test('sair da conta esquece a quantidade, para a próxima conta não herdar', async () => {
  const h = createServices();
  await h.session.saveAuth(session);
  await h.biblioteca.lembrarLivrosLendo(4);

  await h.auth.logoutUser();

  assert.equal(await h.biblioteca.livrosLendoLembrados(), null);
});
