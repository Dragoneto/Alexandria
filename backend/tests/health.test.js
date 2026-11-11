process.env.DB_MODE = 'local';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { criarHealthCheck } = require('../src/controllers/healthController');

function resposta() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('sem Postgres responde ok sem consultar nada', async () => {
  const res = resposta();
  await criarHealthCheck(null)({}, res);
  assert.deepEqual([res.statusCode, res.body], [200, { status: 'ok', database: 'local' }]);
});

test('com Postgres roda SELECT 1 e responde ok', async () => {
  const consultas = [];
  const res = resposta();
  await criarHealthCheck({ query: async (sql) => consultas.push(sql) })({}, res);
  assert.deepEqual(consultas, ['SELECT 1']);
  assert.deepEqual([res.statusCode, res.body], [200, { status: 'ok', database: 'postgres' }]);
});

test('banco fora do ar vira 503 sem vazar a mensagem do erro', async (t) => {
  t.mock.method(console, 'error', () => {});
  const res = resposta();
  await criarHealthCheck({ query: async () => { throw new Error('senha errada para o usuário'); } })({}, res);
  assert.deepEqual([res.statusCode, res.body], [503, { status: 'erro', database: 'postgres' }]);
});
