const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alexandria-biblioteca-'));
process.env.DB_MODE = 'local';
process.env.LOCAL_LIBRARY_FILE = path.join(dataDir, 'biblioteca.json');

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const biblioteca = require('../src/repositories/bibliotecaRepository');

const livro = (id) => ({ id, titulo: `Livro ${id}`, autores: ['Autora'], capa: null });

before(async () => {
  await biblioteca.initialize();
  await biblioteca.create({ userId: 1, livro: livro('OL1W'), status: 'QUERO_LER' });
  await biblioteca.create({ userId: 1, livro: livro('OL2W'), status: 'LENDO' });
  await biblioteca.create({ userId: 2, livro: livro('OL3W'), status: 'LENDO' });
});

after(() => fs.rmSync(dataDir, { recursive: true, force: true }));

test('filtra a biblioteca pelo status sem misturar usuários', async () => {
  const todos = await biblioteca.findByUser(1);
  const lendo = await biblioteca.findByUser(1, 'LENDO');

  assert.equal(todos.length, 2);
  assert.deepEqual(lendo.map((item) => item.livro_id), ['OL2W']);
});

test('atualiza status e favorito somente para o dono do item', async () => {
  const [item] = await biblioteca.findByUser(1, 'QUERO_LER');
  const atualizado = await biblioteca.update(item.id, 1, {
    status: 'LIDO',
    favorito: true,
  });

  assert.equal(atualizado.status, 'LIDO');
  assert.equal(atualizado.favorito, true);
  assert.equal(await biblioteca.update(item.id, 2, { favorito: false }), null);

  const [persistido] = await biblioteca.findByUser(1, 'LIDO');
  assert.equal(persistido.id, item.id);
  assert.equal(persistido.favorito, true);
});
