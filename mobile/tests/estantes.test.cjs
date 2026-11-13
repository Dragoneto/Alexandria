const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

// Transpila e executa o módulo; o único import (o catálogo de categorias) é carregado do mesmo jeito.
function carregar(arquivo, dependencias = {}) {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/constants', arquivo), 'utf8');
  const modulo = { exports: {} };
  new Function(
    'module',
    'exports',
    'require',
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
  )(modulo, modulo.exports, (nome) => dependencias[nome] ?? require(nome));
  return modulo;
}
const categorias = carregar('categorias.ts');
const { TODAS_AS_CATEGORIAS, GRUPOS_DE_CATEGORIAS } = categorias.exports;
const estantes = carregar('estantes.ts', { '@/constants/categorias': categorias.exports });
const {
  AUTORES,
  AUTORES_INTERNACIONAIS,
  AUTORES_NACIONAIS,
  CATEGORIAS,
  PAGINA_MAXIMA,
  embaralhar,
  sortearDestaque,
  sortearEstantes,
} = estantes.exports;

/** Gerador previsível para os testes (LCG simples). */
function semente(valor) {
  let estado = valor;
  return () => {
    estado = (estado * 1664525 + 1013904223) % 4294967296;
    return estado / 4294967296;
  };
}

test('embaralhar mantém os mesmos itens e não altera a lista original', () => {
  const original = [1, 2, 3, 4, 5, 6];
  const resultado = embaralhar(original, semente(7));
  assert.deepEqual(original, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual([...resultado].sort(), original);
});

test('acervo tem 24 autores: 10 nacionais e 14 internacionais, sem repetição', () => {
  assert.equal(AUTORES_NACIONAIS.length, 10);
  assert.equal(AUTORES_INTERNACIONAIS.length, 14);
  assert.equal(AUTORES.length, 24);
  assert.equal(new Set(AUTORES.map((a) => a.busca)).size, 24);
  AUTORES.forEach((a) => assert.ok(a.nome && a.busca.length >= 2));
});

test('mostra primeiro 3 categorias diferentes e depois 1 autor nacional e 1 internacional', () => {
  const nacionais = AUTORES_NACIONAIS.map((a) => a.busca);
  const internacionais = AUTORES_INTERNACIONAIS.map((a) => a.busca);
  for (let s = 1; s <= 50; s += 1) {
    const lista = sortearEstantes({}, semente(s));

    assert.equal(lista.length, 5);
    const [c1, c2, c3, nacional, internacional] = lista;
    [c1, c2, c3].forEach((e) => {
      assert.ok(TODAS_AS_CATEGORIAS.includes(e.category));
      // Estante de categoria busca só pela categoria e usa o nome dela como título
      assert.equal(e.query, '');
      assert.equal(e.title, e.category);
    });
    assert.equal(new Set([c1, c2, c3].map((e) => e.category)).size, 3);
    assert.equal(nacional.category, undefined);
    assert.equal(internacional.category, undefined);
    assert.ok(nacionais.includes(nacional.query));
    assert.ok(internacionais.includes(internacional.query));
    assert.equal(new Set(lista.map((e) => e.key)).size, 5);
    lista.forEach((e) => assert.ok(e.page >= 1 && e.page <= PAGINA_MAXIMA));
  }
});

test('estante de autor estrangeiro mostra o nome em português e busca pela grafia da Open Library', () => {
  const tolstoi = AUTORES_INTERNACIONAIS.find((a) => a.nome === 'Liev Tolstói');
  assert.equal(tolstoi.busca, 'Leo Tolstoy');
});

test('sorteios diferentes geram homes diferentes', () => {
  const combinacoes = new Set();
  for (let s = 1; s <= 20; s += 1) {
    combinacoes.add(
      sortearEstantes({}, semente(s))
        .map((e) => `${e.key}:${e.query}`)
        .join('|'),
    );
  }
  assert.ok(combinacoes.size > 15);
});

test('mesmo com aleatório no limite (0 e quase 1) não sai do intervalo', () => {
  for (const valor of [0, 0.9999999999]) {
    const lista = sortearEstantes({}, () => valor);
    assert.equal(lista.length, 5);
    lista.forEach((e) =>
      assert.ok(e.page >= 1 && e.page <= PAGINA_MAXIMA && (e.query || e.category)),
    );
  }
});

test('destaque usa um autor ou uma categoria aceita pelo backend', () => {
  for (let s = 1; s <= 30; s += 1) {
    const d = sortearDestaque(semente(s));
    if (d.category) {
      assert.ok(TODAS_AS_CATEGORIAS.includes(d.category));
      assert.equal(d.query, '');
    } else assert.ok(AUTORES.some((a) => a.busca === d.query));
  }
});

test('os atalhos de categoria da home são os 11 grupos e as estantes variam entre todas as categorias', () => {
  assert.deepEqual(
    [...CATEGORIAS],
    GRUPOS_DE_CATEGORIAS.map((g) => g.nome),
  );
  assert.equal(CATEGORIAS.length, 11);
  const vistas = new Set();
  for (let s = 1; s <= 200; s += 1) {
    sortearEstantes({}, semente(s)).forEach((e) => e.category && vistas.add(e.category));
  }
  assert.ok(vistas.size > 60, `só ${vistas.size} categorias apareceram`);
});
