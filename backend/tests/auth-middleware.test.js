// O repositório lê o modo do banco ao carregar
process.env.DB_MODE = 'local';
process.env.JWT_SECRET = 'segredo-de-teste';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const jwt = require('jsonwebtoken');

const authMiddleware = require('../src/middlewares/authMiddleware');
const users = require('../src/repositories/userRepository');

/** Passa o token pelo middleware, com a busca do usuário simulada, e diz se ele deixou seguir para a rota. */
async function passar(t, token, findById) {
  t.mock.method(users, 'findById', findById);
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  let seguiu = false;
  await authMiddleware(req, res, () => (seguiu = true));
  return { req, res, seguiu };
}

const tokenDe = (id) => jwt.sign({ id }, process.env.JWT_SECRET);

test('token inválido continua 401, sem consultar o banco', async (t) => {
  const { res, seguiu } = await passar(t, 'abc', async () => assert.fail('consultou o banco'));
  assert.deepEqual([res.statusCode, res.body.error, seguiu], [401, 'Token inválido ou expirado', false]);
});

test('token de usuário que existe segue para a rota com req.user preenchido', async (t) => {
  const { req, seguiu } = await passar(t, tokenDe(7), async (id) => (id === 7 ? { id } : null));
  assert.deepEqual([seguiu, req.user.id], [true, 7]);
});

test('token válido de usuário que não existe mais responde 401', async (t) => {
  const { res, seguiu } = await passar(t, tokenDe(9999), async () => null);
  assert.deepEqual([res.statusCode, res.body.error, seguiu], [401, 'Sessão inválida. Entre novamente.', false]);
});

test('falha do banco ao conferir o usuário responde 500, sem deslogar', async (t) => {
  t.mock.method(console, 'error', () => {});
  const { res, seguiu } = await passar(t, tokenDe(1), async () => Promise.reject(new Error('banco fora do ar')));
  assert.deepEqual([res.statusCode, seguiu], [500, false]);
});
