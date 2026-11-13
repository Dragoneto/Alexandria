const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

// curiosidades.ts não importa nada, então basta transpilar e executar
const source = fs.readFileSync(path.resolve(__dirname, '../src/constants/curiosidades.ts'), 'utf8');
const modulo = { exports: {} };
new Function(
  'module',
  'exports',
  ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
)(modulo, modulo.exports);
const { CURIOSIDADES, CATEGORIAS_CURIOSIDADES, sortearOutra } = modulo.exports;

test('há pelo menos 40 curiosidades, com id e texto únicos', () => {
  assert.ok(CURIOSIDADES.length >= 40, `só ${CURIOSIDADES.length} curiosidades`);
  assert.equal(new Set(CURIOSIDADES.map((c) => c.id)).size, CURIOSIDADES.length);
  assert.equal(new Set(CURIOSIDADES.map((c) => c.texto)).size, CURIOSIDADES.length);
});

test('toda curiosidade tem uma categoria conhecida e toda categoria tem curiosidades', () => {
  for (const item of CURIOSIDADES) assert.ok(CATEGORIAS_CURIOSIDADES.includes(item.categoria));
  for (const categoria of CATEGORIAS_CURIOSIDADES) {
    assert.ok(
      CURIOSIDADES.filter((item) => item.categoria === categoria).length >= 4,
      `${categoria} tem poucas curiosidades`,
    );
  }
});

test('os textos não usam emoji', () => {
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  for (const item of CURIOSIDADES) assert.doesNotMatch(item.texto, emoji, `id ${item.id}`);
});

test('sortearOutra nunca repete a curiosidade que está na tela', () => {
  const lista = CURIOSIDADES.slice(0, 3);
  for (const aleatorio of [() => 0, () => 0.5, () => 0.99]) {
    assert.notEqual(sortearOutra(lista, lista[0].id, aleatorio).id, lista[0].id);
  }
  assert.equal(sortearOutra(lista.slice(0, 1), lista[0].id).id, lista[0].id);
  assert.equal(sortearOutra([], null), null);
});
