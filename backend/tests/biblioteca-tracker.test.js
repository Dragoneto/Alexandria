const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alexandria-tracker-'));
process.env.DB_MODE = 'local';
process.env.LOCAL_LIBRARY_FILE = path.join(dataDir, 'biblioteca.json');

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const openLibrary = require('../src/services/openLibrary');
const {
  update,
  registrarDia,
  hojeNoBrasil,
} = require('../src/controllers/bibliotecaController');
const biblioteca = require('../src/repositories/bibliotecaRepository');

const livro = (id) => ({ id, titulo: `Livro ${id}`, autores: ['Autora'], capa: null });
const paginasPorLivro = { OL10W: 320, OL11W: null, OL12W: 200 };
const getPageCountOriginal = openLibrary.getPageCount;

before(async () => {
  openLibrary.getPageCount = async (id) => paginasPorLivro[id] ?? null;
  await biblioteca.initialize();
  await biblioteca.create({ userId: 1, livro: livro('OL10W'), status: 'QUERO_LER' });
  await biblioteca.create({ userId: 1, livro: livro('OL11W'), status: 'QUERO_LER' });
  await biblioteca.create({ userId: 1, livro: livro('OL12W'), status: 'QUERO_LER' });
  await biblioteca.create({ userId: 2, livro: livro('OL10W'), status: 'LENDO' });
});

after(() => {
  openLibrary.getPageCount = getPageCountOriginal;
  fs.rmSync(dataDir, { recursive: true, force: true });
});

async function chamar(handler, { body, params, userId = 1 } = {}) {
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
  await handler({ user: { id: userId }, body, params }, res);
  return res;
}

const itemDe = async (livroId, userId = 1) =>
  (await biblioteca.findByUser(userId)).find((item) => item.livro_id === livroId);

test('hojeNoBrasil usa o fuso de São Paulo', () => {
  // 02:00 UTC ainda é o dia anterior em Brasília (UTC-3)
  assert.equal(hojeNoBrasil(new Date('2026-11-14T02:00:00Z')), '2026-11-13');
  assert.equal(hojeNoBrasil(new Date('2026-11-14T04:00:00Z')), '2026-11-14');
});

test('marcar "Lendo" busca as páginas e já conta o dia de hoje', async () => {
  const item = await itemDe('OL10W');
  const res = await chamar(update, { params: { id: String(item.id) }, body: { status: 'LENDO' } });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.item.progresso, {
    paginaAtual: 0,
    paginasTotal: 320,
    diasLeitura: 1,
    concluidoEm: null,
  });
});

test('abrir o app no mesmo dia não conta de novo; outro usuário não é afetado', async () => {
  const res = await chamar(registrarDia);
  assert.equal(res.body.livrosAtualizados, 0);
  assert.equal((await itemDe('OL10W')).dias_leitura, 1);

  const outro = await chamar(registrarDia, { userId: 2 });
  assert.equal(outro.body.livrosAtualizados, 1);
  assert.equal((await itemDe('OL10W')).dias_leitura, 1);
});

test('um novo dia soma 1 só aos livros em "Lendo"', async () => {
  const contados = await biblioteca.registrarDiaDeLeitura(1, '2099-01-01');
  assert.equal(contados, 1);
  assert.equal((await itemDe('OL10W')).dias_leitura, 2);
  assert.equal((await itemDe('OL12W')).dias_leitura, 0);
});

test('página atual é validada contra o total do livro', async () => {
  const item = await itemDe('OL10W');
  const params = { id: String(item.id) };

  assert.equal((await chamar(update, { params, body: { paginaAtual: 999 } })).statusCode, 400);
  assert.equal((await chamar(update, { params, body: { paginaAtual: -1 } })).statusCode, 400);
  assert.equal((await chamar(update, { params, body: { paginaAtual: 1.5 } })).statusCode, 400);
  assert.equal((await chamar(update, { params, body: { paginasTotal: 0 } })).statusCode, 400);

  const ok = await chamar(update, { params, body: { paginaAtual: 120 } });
  assert.equal(ok.body.item.progresso.paginaAtual, 120);
});

test('sem páginas na Open Library, a pessoa informa o total à mão', async () => {
  const item = await itemDe('OL11W');
  const params = { id: String(item.id) };
  const lendo = await chamar(update, { params, body: { status: 'LENDO' } });
  assert.equal(lendo.body.item.progresso.paginasTotal, null);

  const manual = await chamar(update, { params, body: { paginasTotal: 150, paginaAtual: 30 } });
  assert.equal(manual.statusCode, 200);
  assert.equal(manual.body.item.progresso.paginasTotal, 150);
  assert.equal(manual.body.item.progresso.paginaAtual, 30);
});

test('marcar "Lido" completa as páginas e registra a conclusão; voltar desfaz a data', async () => {
  const item = await itemDe('OL12W');
  const params = { id: String(item.id) };
  const lido = await chamar(update, { params, body: { status: 'LIDO' } });

  assert.equal(lido.body.item.progresso.paginasTotal, 200);
  assert.equal(lido.body.item.progresso.paginaAtual, 200);
  assert.match(lido.body.item.progresso.concluidoEm, /^\d{4}-\d{2}-\d{2}T/);

  const voltou = await chamar(update, { params, body: { status: 'LENDO' } });
  assert.equal(voltou.body.item.progresso.concluidoEm, null);
});

test('livros antigos em "Lido" ou "Lendo" ganham o número de páginas ao listar', async () => {
  const { completarPaginas } = require('../src/controllers/bibliotecaController');
  // Itens gravados antes do tracker: sem paginas_total
  await biblioteca.create({ userId: 3, livro: livro('OL12W'), status: 'LIDO' });
  await biblioteca.create({ userId: 3, livro: livro('OL10W'), status: 'LENDO' });
  await biblioteca.create({ userId: 3, livro: livro('OL11W'), status: 'QUERO_LER' });

  await completarPaginas(3, await biblioteca.findByUser(3));

  const lido = await itemDe('OL12W', 3);
  const lendo = await itemDe('OL10W', 3);
  const quero = await itemDe('OL11W', 3);
  assert.equal(lido.paginas_total, 200);
  assert.equal(lido.pagina_atual, 200);
  assert.equal(lendo.paginas_total, 320);
  assert.equal(lendo.pagina_atual, 0);
  assert.equal(quero.paginas_total, null);
});
