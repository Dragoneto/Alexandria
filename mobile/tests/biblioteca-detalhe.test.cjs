const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createServices, json, session } = require('./helpers/services.cjs');

async function logado() {
  const harness = createServices();
  await harness.session.saveAuth(session);
  return harness;
}

const itemDoLivro = (id, livroId, statusLeitura = 'QUERO_LER') => ({
  id,
  statusLeitura,
  favorito: false,
  livro: { id: livroId, titulo: `Livro ${id}`, autores: [], capa: null },
});

test('encontra o item do livro na lista carregada', () => {
  const { biblioteca } = createServices();
  const itens = [itemDoLivro(1, 'OL1W'), itemDoLivro(2, 'OL2W')];
  assert.equal(biblioteca.encontrarItemDoLivro(itens, 'OL2W').id, 2);
  assert.equal(biblioteca.encontrarItemDoLivro(itens, 'OL3W'), null);
  assert.equal(biblioteca.encontrarItemDoLivro([], 'OL1W'), null);
});

test('a trava ignora uma segunda ação no mesmo livro e libera depois', async () => {
  const { biblioteca } = createServices();
  const pendentes = new Set();
  let liberar;
  const primeira = biblioteca.comTrava(pendentes, 'OL1W', () => new Promise((r) => (liberar = r)));
  assert.equal(await biblioteca.comTrava(pendentes, 'OL1W', async () => {}), false);
  assert.equal(await biblioteca.comTrava(pendentes, 'OL2W', async () => {}), true);
  liberar();
  assert.equal(await primeira, true);
  assert.equal(pendentes.size, 0);

  await assert.rejects(
    biblioteca.comTrava(pendentes, 'OL1W', async () => {
      throw new Error('falhou');
    }),
    /falhou/,
  );
  assert.equal(pendentes.size, 0);
});

test('troca o status na hora e confirma com a resposta da API', async () => {
  const harness = await logado();
  const item = itemDoLivro(7, 'OL7W');
  const aplicados = [];
  harness.fetch = async (url, options) => {
    assert.equal(url, 'http://localhost:3000/api/biblioteca/7');
    assert.equal(options.method, 'PATCH');
    assert.deepEqual(JSON.parse(options.body), { status: 'LIDO' });
    assert.equal(aplicados.at(-1).statusLeitura, 'LIDO');
    return json({ item: { ...item, statusLeitura: 'LIDO', favorito: true } });
  };

  await harness.biblioteca.trocarStatusOtimista(item, 'LIDO', (novo) => aplicados.push(novo));
  assert.deepEqual(
    aplicados.map((novo) => [novo.statusLeitura, novo.favorito]),
    [
      ['LIDO', false],
      ['LIDO', true],
    ],
  );
});

test('falha na troca restaura o status anterior e repassa o erro', async () => {
  const harness = await logado();
  const item = itemDoLivro(7, 'OL7W', 'LENDO');
  const aplicados = [];
  harness.fetch = async () => json({ error: 'Livro não encontrado na sua biblioteca.' }, 404);

  await assert.rejects(
    harness.biblioteca.trocarStatusOtimista(item, 'LIDO', (novo) => aplicados.push(novo)),
    { status: 404 },
  );
  assert.deepEqual(
    aplicados.map((novo) => novo.statusLeitura),
    ['LIDO', 'LENDO'],
  );

  harness.fetch = async () => {
    throw new Error('Requisição inesperada');
  };
  await harness.biblioteca.trocarStatusOtimista(item, 'LENDO', (novo) => aplicados.push(novo));
  assert.equal(aplicados.length, 2);
});

test('adiciona o livro como Quero ler e repassa o 409 de quem já tinha', async () => {
  const harness = await logado();
  const item = itemDoLivro(8, 'OL8W');
  harness.fetch = async (url, options) => {
    assert.equal(url, 'http://localhost:3000/api/biblioteca');
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), { livroId: 'OL8W', status: 'QUERO_LER' });
    return json({ item }, 201);
  };
  assert.deepEqual(await harness.biblioteca.adicionarNaBiblioteca('OL8W'), item);

  harness.fetch = async () => json({ error: 'Este livro já está na sua biblioteca.' }, 409);
  await assert.rejects(harness.biblioteca.adicionarNaBiblioteca('OL8W'), { status: 409 });
});

test('remove pelo id do item e repassa o 404 de quem já tinha saído', async () => {
  const harness = await logado();
  harness.fetch = async (url, options) => {
    assert.equal(url, 'http://localhost:3000/api/biblioteca/8');
    assert.equal(options.method, 'DELETE');
    return json({ message: 'Livro removido da biblioteca' });
  };
  await harness.biblioteca.removerDaBiblioteca(8);

  harness.fetch = async () => json({ error: 'Livro não encontrado na sua biblioteca.' }, 404);
  await assert.rejects(harness.biblioteca.removerDaBiblioteca(8), { status: 404 });
});
