const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

// categorias.ts não importa nada, então basta transpilar e executar
const source = fs.readFileSync(path.resolve(__dirname, '../src/constants/categorias.ts'), 'utf8');
const modulo = { exports: {} };
new Function(
  'module',
  'exports',
  ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
)(modulo, modulo.exports);
const { GRUPOS_DE_CATEGORIAS, TODAS_AS_CATEGORIAS, ehCategoria, grupoDaCategoria } = modulo.exports;
const backend = require('../../backend/src/constants/categorias.js');

test('o app tem exatamente as mesmas categorias, na mesma ordem, que o backend aceita', () => {
  assert.deepEqual(
    GRUPOS_DE_CATEGORIAS.map((g) => ({ nome: g.nome, subcategorias: [...g.subcategorias] })),
    backend.GRUPOS.map((g) => ({
      nome: g.nome,
      subcategorias: g.subcategorias.map((s) => s.nome),
    })),
  );
  assert.deepEqual([...TODAS_AS_CATEGORIAS], [...backend.FILTRO_POR_CATEGORIA.keys()]);
});

test('nomes únicos, grupo encontrado pela subcategoria e as seis categorias antigas continuam', () => {
  assert.equal(new Set(TODAS_AS_CATEGORIAS).size, TODAS_AS_CATEGORIAS.length);
  assert.equal(grupoDaCategoria('Poesia').nome, 'Ficção');
  assert.equal(grupoDaCategoria('Artes').nome, 'Artes');
  assert.equal(grupoDaCategoria('Inexistente'), undefined);
  for (const antiga of ['Fantasia', 'Romance', 'História', 'Tecnologia', 'Biografia', 'Mistério']) {
    assert.ok(ehCategoria(antiga), antiga);
  }
  assert.ok(!ehCategoria('Em inglês'));
});
