const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const { checkRailwayUrl, readEnvFile } = require('../scripts/start-railway.js');

const PRODUCTION_ENV_FILE = path.join(__dirname, '..', '.env.production');

function writeTempEnv(content) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'alexandria-env-')), '.env');
  fs.writeFileSync(file, content);
  return file;
}

test('lê o arquivo .env respeitando aspas, comentários e a última ocorrência', () => {
  const file = writeTempEnv(
    [
      '# comentário solto',
      'EXPO_PUBLIC_API_URL=http://localhost:3000',
      '   EXPO_PUBLIC_API_TIMEOUT = 2500   # espera menor',
      'EXPO_PUBLIC_OUTRO="com aspas"',
      'linha sem igual',
      'EXPO_PUBLIC_API_URL=https://publicado.up.railway.app',
    ].join('\r\n'),
  );

  assert.deepEqual(readEnvFile(file), {
    EXPO_PUBLIC_API_URL: 'https://publicado.up.railway.app',
    EXPO_PUBLIC_API_TIMEOUT: '2500',
    EXPO_PUBLIC_OUTRO: 'com aspas',
  });
});

test('arquivo inexistente não quebra a leitura', () => {
  assert.deepEqual(readEnvFile(path.join(os.tmpdir(), 'nao-existe-alexandria', '.env')), {});
});

test('avisa quando o link do Railway ainda não foi colado', () => {
  for (const value of [undefined, '', '   ']) {
    const result = checkRailwayUrl(value);
    assert.equal(result.ok, false);
    assert.match(result.message, /\.env\.production/);
  }
});

test('recusa endereço que o app não conseguiria usar', () => {
  const recusados = [
    'publicado.up.railway.app',
    'ftp://publicado.up.railway.app',
    'https://publicado.up.railway.app/api',
    'https://publicado.up.railway.app/API/',
    'https://usuario:senha@publicado.up.railway.app',
    'https://publicado.up.railway.app/?token=1',
    'https://publicado.up.railway.app/#topo',
  ];

  for (const value of recusados) {
    assert.equal(checkRailwayUrl(value).ok, false, `deveria recusar ${value}`);
  }
});

test('aceita o endereço do backend e remove a barra final', () => {
  assert.deepEqual(checkRailwayUrl('  https://publicado.up.railway.app//  '), {
    ok: true,
    url: 'https://publicado.up.railway.app',
  });

  assert.deepEqual(checkRailwayUrl('http://192.168.0.10:3000'), {
    ok: true,
    url: 'http://192.168.0.10:3000',
  });
});

test('o .env.production do repositório declara a variável e, se preenchida, passa na validação', () => {
  const values = readEnvFile(PRODUCTION_ENV_FILE);

  assert.ok(
    'EXPO_PUBLIC_API_URL' in values,
    'mobile/.env.production precisa declarar EXPO_PUBLIC_API_URL',
  );

  if (values.EXPO_PUBLIC_API_URL) {
    const result = checkRailwayUrl(values.EXPO_PUBLIC_API_URL);
    assert.equal(result.ok, true, result.message);
  }
});
