const assert = require('node:assert/strict');
const { test } = require('node:test');

const { validarBancoDeTeste } = require('./persistencia/banco-de-teste');

const SEGURA = 'postgresql://teste:senhaSecreta@localhost:55432/alexandria_test';
const validar = (url, ambiente = {}, arquivoEnv = {}) => validarBancoDeTeste(url, { ambiente, arquivoEnv });

test('aceita um banco local com "test" no nome', () => {
  assert.deepEqual(validar(SEGURA), { host: 'localhost', porta: '55432', banco: 'alexandria_test' });
  assert.equal(validar('postgresql://u:p@127.0.0.1/banco_de_teste').banco, 'banco_de_teste');
});

test('recusa banco sem "test" no nome, como o de produção ou o de desenvolvimento', () => {
  for (const banco of ['railway', 'alexandria', 'postgres']) {
    assert.throws(() => validar(`postgresql://u:p@localhost:5432/${banco}`), /não parece de teste/);
  }
});

test('recusa host remoto, a menos que seja liberado de propósito', () => {
  const remota = 'postgresql://u:p@monorail.proxy.rlwy.net:5432/alexandria_test';
  assert.throws(() => validar(remota), /não é local/);
  assert.equal(validar(remota, { TEST_DATABASE_PERMITIR_REMOTO: 'true' }).host, 'monorail.proxy.rlwy.net');
});

test('recusa o banco da aplicação, venha ele do ambiente ou do .env, por URL ou por DB_*', () => {
  const mesmo = /banco que a aplicação usa/;
  const DATABASE_URL = 'postgresql://outro:outra@127.0.0.1:55432/alexandria_test';
  const campos = { DB_HOST: 'localhost', DB_PORT: '55432', DB_NAME: 'alexandria_test' };

  assert.throws(() => validar(SEGURA, { DATABASE_URL }), mesmo);
  assert.throws(() => validar(SEGURA, {}, { DATABASE_URL }), mesmo);
  assert.throws(() => validar(SEGURA, campos), mesmo);
  assert.throws(() => validar(SEGURA, {}, campos), mesmo);

  assert.ok(validar(SEGURA, { DATABASE_URL: 'postgresql://u:p@localhost:55432/outro_banco' }));
  assert.ok(validar(SEGURA, { ...campos, DB_PORT: '5432' }));
});

test('recusa rodar com NODE_ENV=production e URL que não seja do PostgreSQL', () => {
  assert.throws(() => validar(SEGURA, { NODE_ENV: 'production' }), /production/);
  assert.throws(() => validar('mysql://u:p@localhost/alexandria_test'), /postgresql:\/\//);
  assert.throws(() => validar('nao é url'), /URL válida/);
});

test('nenhuma mensagem de erro cita a senha', () => {
  const casos = [
    () => validar('postgresql://u:senhaSecreta@localhost/producao'),
    () => validar('postgresql://u:senhaSecreta@remoto.com/alexandria_test'),
    () => validar(SEGURA, { DATABASE_URL: SEGURA }),
    () => validar('postgresql://u:senhaSecreta@ host invalido/alexandria_test'),
  ];
  for (const caso of casos) {
    assert.throws(caso, (erro) => !erro.message.includes('senhaSecreta'));
  }
});
