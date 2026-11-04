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

test('busca por título ou autor sem diferenciar caixa e acentos, combinada com os filtros', () => {
  const { biblioteca } = createServices();
  const livro = (id, titulo, autores, statusLeitura, favorito) => ({
    id,
    statusLeitura,
    favorito,
    livro: { id: `OL${id}W`, titulo, autores, capa: null },
  });
  const itens = [
    livro(1, 'Dom Casmurro', ['Machado de Assis'], 'LIDO', true),
    livro(2, 'Memórias Póstumas de Brás Cubas', ['Machado de Assis'], 'LENDO', false),
    livro(3, 'O Senhor dos Anéis', ['J.R.R. Tolkien'], 'LENDO', true),
    livro(4, 'Sem autoria', [], 'QUERO_LER', false),
  ];
  const ids = (filtro) => biblioteca.filtrarBiblioteca(itens, filtro).map((item) => item.id);

  assert.deepEqual(ids({ busca: 'casmurro' }), [1]);
  assert.deepEqual(ids({ busca: 'MEMORIAS postumas' }), [2]);
  assert.deepEqual(ids({ busca: 'aneis' }), [3]);
  assert.deepEqual(ids({ busca: 'tolkien' }), [3]);
  assert.deepEqual(ids({ busca: 'machado' }), [1, 2]);
  assert.deepEqual(ids({ busca: '  machado   de  assis ' }), [1, 2]);
  assert.deepEqual(ids({ busca: '   ' }), [1, 2, 3, 4]);
  assert.deepEqual(ids({ busca: '' }), [1, 2, 3, 4]);
  assert.deepEqual(ids({ busca: 'machado', status: 'LENDO' }), [2]);
  assert.deepEqual(ids({ busca: 'machado', somenteFavoritos: true }), [1]);
  assert.deepEqual(ids({ busca: 'machado', status: 'LENDO', somenteFavoritos: true }), []);
  assert.deepEqual(ids({ busca: 'dostoievski' }), []);
});

test('normaliza o texto da busca', () => {
  const { biblioteca } = createServices();
  assert.equal(biblioteca.normalizarBusca('  Ação  e   REAÇÃO '), 'acao e reacao');
  assert.equal(biblioteca.normalizarBusca('   '), '');
});

test('a busca acompanha a lista depois de editar ou remover e trata a lista vazia', () => {
  const { biblioteca } = createServices();
  const livro = (id, titulo, statusLeitura, favorito) => ({
    id,
    statusLeitura,
    favorito,
    livro: { id: `OL${id}W`, titulo, autores: ['Machado de Assis'], capa: null },
  });
  let itens = [livro(1, 'Dom Casmurro', 'LIDO', true), livro(2, 'Helena', 'LENDO', false)];
  const ids = (filtro) => biblioteca.filtrarBiblioteca(itens, filtro).map((item) => item.id);
  const filtro = { busca: 'machado', status: 'LENDO' };

  assert.deepEqual(ids(filtro), [2]);
  itens = itens.map((item) => (item.id === 1 ? { ...item, statusLeitura: 'LENDO' } : item));
  assert.deepEqual(ids(filtro), [1, 2]);
  itens = itens.map((item) => (item.id === 1 ? { ...item, favorito: false } : item));
  assert.deepEqual(ids({ busca: 'machado', somenteFavoritos: true }), []);
  itens = itens.filter((item) => item.id !== 2);
  assert.deepEqual(ids(filtro), [1]);
  itens = [];
  assert.deepEqual(ids(filtro), []);
  assert.deepEqual(ids({ busca: 'machado' }), []);
});
