const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

// tempo.ts não importa nada, então basta transpilar e executar
const source = fs.readFileSync(path.resolve(__dirname, '../src/constants/tempo.ts'), 'utf8');
const modulo = { exports: {} };
new Function(
  'module',
  'exports',
  ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
)(modulo, modulo.exports);
const { tempoRelativo } = modulo.exports;

const agora = new Date('2026-11-13T12:00:00Z').getTime();
const antes = (ms) => new Date(agora - ms).toISOString();
const MIN = 60_000;

test('tempoRelativo usa minutos, horas e dias como as redes de leitura', () => {
  assert.equal(tempoRelativo(antes(20_000), agora), 'agora');
  assert.equal(tempoRelativo(antes(5 * MIN), agora), 'há 5 min');
  assert.equal(tempoRelativo(antes(3 * 60 * MIN), agora), 'há 3 h');
  assert.equal(tempoRelativo(antes(30 * 60 * MIN), agora), 'ontem');
  assert.equal(tempoRelativo(antes(4 * 24 * 60 * MIN), agora), 'há 4 dias');
});

test('tempoRelativo mostra a data depois de uma semana e o ano só quando muda', () => {
  const mesmoAno = tempoRelativo('2026-10-12T12:00:00Z', agora);
  assert.match(mesmoAno, /12/);
  assert.doesNotMatch(mesmoAno, /2026/);
  assert.match(tempoRelativo('2025-03-02T12:00:00Z', agora), /2025/);
});

test('tempoRelativo ignora data inválida e relógio adiantado', () => {
  assert.equal(tempoRelativo('não é data', agora), '');
  assert.equal(tempoRelativo(new Date(agora + 5 * MIN).toISOString(), agora), 'agora');
});
