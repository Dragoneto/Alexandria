const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

// faq.ts não importa nada, então basta transpilar e executar
const source = fs.readFileSync(path.resolve(__dirname, '../src/constants/faq.ts'), 'utf8');
const modulo = { exports: {} };
new Function(
  'module',
  'exports',
  ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
)(modulo, modulo.exports);
const { FAQ, MAIS_PROCURADAS, filtrarFaq, partesDestacadas } = modulo.exports;

const todas = FAQ.flatMap((secao) => secao.perguntas);

test('perguntas únicas, com resposta, e as mais procuradas existem no FAQ', () => {
  assert.ok(todas.length >= 25);
  assert.equal(new Set(todas.map((p) => p.pergunta)).size, todas.length);
  for (const item of todas) assert.ok(item.resposta.length > 20, item.pergunta);
  for (const pergunta of MAIS_PROCURADAS) {
    assert.ok(
      todas.some((p) => p.pergunta === pergunta),
      pergunta,
    );
  }
});

test('filtrarFaq ignora acentos e combina assunto com termo', () => {
  const porSenha = filtrarFaq(FAQ, 'SENHA', null);
  assert.deepEqual(
    porSenha.map((s) => s.assunto),
    ['Conta'],
  );
  assert.ok(filtrarFaq(FAQ, 'paginas', null).some((s) => s.assunto === 'Tracker de leitura'));
  assert.deepEqual(filtrarFaq(FAQ, 'senha', 'Tracker de leitura'), []);
  assert.equal(filtrarFaq(FAQ, '', 'Conta')[0].perguntas.length, FAQ[0].perguntas.length);
});

test('partesDestacadas marca o termo sem perder a grafia original', () => {
  assert.deepEqual(partesDestacadas('Número de páginas', 'paginas'), [
    { texto: 'Número de ', destaque: false },
    { texto: 'páginas', destaque: true },
  ]);
  // Só no começo das palavras: 'reler' não acende
  assert.deepEqual(partesDestacadas('Ler e reler, ler', 'ler'), [
    { texto: 'Ler', destaque: true },
    { texto: ' e reler, ', destaque: false },
    { texto: 'ler', destaque: true },
  ]);
  assert.equal(
    filtrarFaq(FAQ, 'senha', null)
      .flatMap((s) => s.perguntas)
      .some((p) => p.pergunta === 'Como avalio um livro?'),
    false,
  );
  assert.deepEqual(partesDestacadas('Sem termo', '  '), [{ texto: 'Sem termo', destaque: false }]);
});
