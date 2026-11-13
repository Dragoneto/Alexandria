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

const itemDoLivro = (statusLeitura) => ({
  id: 9,
  statusLeitura,
  favorito: false,
  livro: { id: 'OL1W', titulo: 'Dom Casmurro', autores: ['Machado de Assis'], capa: null },
});

test('marcar como lido adiciona o livro quando ele ainda não está na biblioteca', async () => {
  const harness = await logado();
  const chamadas = [];
  harness.fetch = async (url, options = {}) => {
    chamadas.push(`${options.method ?? 'GET'} ${url.replace('http://localhost:3000', '')}`);
    if (!options.method || options.method === 'GET') return json({ itens: [] });
    assert.deepEqual(JSON.parse(options.body), { livroId: 'OL1W', status: 'LIDO' });
    return json({ item: itemDoLivro('LIDO') }, 201);
  };

  const item = await harness.biblioteca.marcarComoLido('OL1W');
  assert.equal(item.statusLeitura, 'LIDO');
  assert.deepEqual(chamadas, ['GET /api/biblioteca', 'POST /api/biblioteca']);
});

test('marcar como lido atualiza o status quando o livro já está na biblioteca', async () => {
  const harness = await logado();
  const chamadas = [];
  harness.fetch = async (url, options = {}) => {
    chamadas.push(`${options.method ?? 'GET'} ${url.replace('http://localhost:3000', '')}`);
    if (!options.method || options.method === 'GET') return json({ itens: [itemDoLivro('LENDO')] });
    assert.deepEqual(JSON.parse(options.body), { status: 'LIDO' });
    return json({ item: itemDoLivro('LIDO') });
  };

  await harness.biblioteca.marcarComoLido('OL1W');
  assert.deepEqual(chamadas, ['GET /api/biblioteca', 'PATCH /api/biblioteca/9']);
});

test('marcar como lido não chama a API de novo se o livro já está como lido', async () => {
  const harness = await logado();
  let chamadas = 0;
  harness.fetch = async () => {
    chamadas += 1;
    return json({ itens: [itemDoLivro('LIDO')] });
  };

  assert.equal((await harness.biblioteca.marcarComoLido('OL1W')).statusLeitura, 'LIDO');
  assert.equal(chamadas, 1);
});

test('livroEstaNaBiblioteca responde true para o livro com qualquer status', async () => {
  const harness = await logado();
  for (const status of ['QUERO_LER', 'LENDO', 'LIDO', 'ABANDONADO']) {
    harness.fetch = async () => json({ itens: [itemDoLivro(status)] });
    assert.equal(await harness.biblioteca.livroEstaNaBiblioteca('OL1W'), true);
    assert.equal(await harness.biblioteca.livroEstaNaBiblioteca('OL2W'), false);
  }

  harness.fetch = async () => json({ itens: [] });
  assert.equal(await harness.biblioteca.livroEstaNaBiblioteca('OL1W'), false);
});

test('resumoDeLeitura soma livros lidos inteiros e o resto até a página atual; dias não se somam', () => {
  const { biblioteca } = createServices();
  const progresso = (paginaAtual, paginasTotal, diasLeitura) => ({
    paginaAtual,
    paginasTotal,
    diasLeitura,
    concluidoEm: null,
  });
  const itens = [
    { id: 1, statusLeitura: 'LIDO', progresso: progresso(0, 300, 4) },
    { id: 2, statusLeitura: 'LENDO', progresso: progresso(120, 400, 3) },
    { id: 3, statusLeitura: 'LIDO', progresso: progresso(150, null, 0) },
    { id: 4, statusLeitura: 'QUERO_LER' },
  ];

  assert.deepEqual(biblioteca.resumoDeLeitura(itens), {
    lidos: 2,
    lendo: 1,
    paginasLidas: 300 + 120 + 150,
    diasLeitura: 4,
  });
  assert.deepEqual(biblioteca.resumoDeLeitura([]), {
    lidos: 0,
    lendo: 0,
    paginasLidas: 0,
    diasLeitura: 0,
  });
});

test('buscarDiasDeLeitura lê o total do servidor e aceita servidor antigo', async () => {
  const harness = createServices();
  await harness.session.saveAuth(session);
  harness.fetch = async (url) => {
    assert.match(String(url), /\/api\/biblioteca\/dias-de-leitura$/);
    return json({ diasLeitura: 12 });
  };
  assert.equal(await harness.biblioteca.buscarDiasDeLeitura(), 12);

  harness.fetch = async () => json({});
  assert.equal(await harness.biblioteca.buscarDiasDeLeitura(), null);
});

test('porcentagemLida só existe quando o livro tem número de páginas', () => {
  const { biblioteca } = createServices();
  assert.equal(biblioteca.porcentagemLida({ paginaAtual: 50, paginasTotal: 200 }), 25);
  assert.equal(biblioteca.porcentagemLida({ paginaAtual: 250, paginasTotal: 200 }), 100);
  assert.equal(biblioteca.porcentagemLida({ paginaAtual: 50, paginasTotal: null }), null);
  assert.equal(biblioteca.porcentagemLida(undefined), null);
});

test('registra o dia de leitura e envia o progresso pelo PATCH', async () => {
  const harness = await logado();
  const chamadas = [];
  harness.fetch = async (url, options) => {
    chamadas.push([url, options.method, options.body ? JSON.parse(options.body) : null]);
    return json(url.endsWith('dia-de-leitura') ? { livrosAtualizados: 1 } : { item: { id: 5 } });
  };

  await harness.biblioteca.registrarDiaDeLeitura();
  await harness.biblioteca.atualizarItemBiblioteca(5, { paginaAtual: 42, paginasTotal: 180 });

  assert.deepEqual(chamadas, [
    ['http://localhost:3000/api/biblioteca/dia-de-leitura', 'POST', null],
    ['http://localhost:3000/api/biblioteca/5', 'PATCH', { paginaAtual: 42, paginasTotal: 180 }],
  ]);
});
