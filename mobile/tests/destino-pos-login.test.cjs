const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

function carregar() {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../src/services/destino-pos-login.ts'),
    'utf8',
  );
  const modulo = { exports: {} };
  new Function(
    'module',
    'exports',
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
  )(modulo, modulo.exports);
  return modulo.exports;
}

test('link de livro, avaliação ou conversa aberto sem login é lembrado uma vez só', () => {
  const destino = carregar();
  for (const rota of ['/livro/OL1003040W', '/avaliacao/12', '/comentario/7', '/notificacoes']) {
    destino.lembrarDestino(rota);
    assert.equal(destino.consumirDestino(), rota);
    assert.equal(destino.consumirDestino(), null);
  }
});

test('rotas públicas, a home e caminhos estranhos não viram destino', () => {
  const destino = carregar();
  for (const rota of [
    '/',
    '/login',
    '/home',
    '/cadastro',
    '//evil.com',
    '/livro/',
    '/livro/a/b',
    undefined,
  ]) {
    destino.lembrarDestino(rota);
    assert.equal(destino.consumirDestino(), null, String(rota));
  }
});

test('sessão já ativa descarta o destino', () => {
  const destino = carregar();
  destino.lembrarDestino('/livro/OL1W');
  destino.descartarDestino();
  assert.equal(destino.consumirDestino(), null);
});
