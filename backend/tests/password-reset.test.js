// As variáveis precisam existir antes dos require: os módulos leem o ambiente ao carregar.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alexandria-reset-'));

process.env.NODE_ENV = 'test';
process.env.DB_MODE = 'local';
process.env.LOCAL_DB_FILE = path.join(dataDir, 'users.json');
process.env.LOCAL_RESETS_FILE = path.join(dataDir, 'password-resets.json');
process.env.JWT_SECRET = 'segredo-de-teste';

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const bcrypt = require('bcrypt');

const { forgotPassword, register, resetPassword } = require('../src/controllers/authController');
const passwordResets = require('../src/repositories/passwordResetRepository');
const users = require('../src/repositories/userRepository');

/** Resposta falsa do Express: guarda status e corpo para a asserção. */
function fakeResponse() {
  return {
    statusCode: 0,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

async function pedirLink(email) {
  const res = fakeResponse();
  await forgotPassword({ body: { email } }, res);
  return res;
}

async function redefinir(token, senha) {
  const res = fakeResponse();
  await resetPassword({ body: { token, senha } }, res);
  return res;
}

before(async () => {
  await users.initialize();
  await passwordResets.initialize();

  const res = fakeResponse();
  await register(
    { body: { nome: 'Leitora', email: 'leitora@alexandria.com', senha: 'senhaAntiga1' } },
    res,
  );
  assert.equal(res.statusCode, 201);
});

after(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('pedido sem e-mail é recusado', async () => {
  const res = await pedirLink('   ');
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /Email/);
});

test('e-mail sem conta recebe a mesma resposta, e sem token', async () => {
  const res = await pedirLink('ninguem@alexandria.com');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.resetToken, undefined);
  assert.match(res.body.message, /Se existir uma conta/);
});

test('e-mail com conta recebe o link, e o token não fica salvo em texto', async () => {
  const res = await pedirLink('LEITORA@alexandria.com');

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.resetToken.length, 64);
  assert.equal(res.body.resetUrl, `alexandriamobile://redefinir-senha?token=${res.body.resetToken}`);

  const salvo = fs.readFileSync(process.env.LOCAL_RESETS_FILE, 'utf8');
  assert.ok(!salvo.includes(res.body.resetToken), 'o token não pode ser gravado em texto puro');
});

test('senha curta não redefine', async () => {
  const { body } = await pedirLink('leitora@alexandria.com');
  const res = await redefinir(body.resetToken, 'curta12');

  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /pelo menos 8 caracteres/);
});

test('token desconhecido não redefine', async () => {
  const res = await redefinir('nao-existe', 'senhaNova123');

  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /Link inválido ou expirado/);
});

test('token vencido não redefine', async () => {
  const usuario = await users.findByEmail('leitora@alexandria.com');
  const token = 'token-vencido-de-teste';

  await passwordResets.create({
    userId: usuario.id,
    token,
    expiraEm: new Date(Date.now() - 1000),
  });

  const res = await redefinir(token, 'senhaNova123');
  assert.equal(res.statusCode, 400);
});

test('token válido troca a senha e derruba os outros links abertos', async () => {
  const primeiro = await pedirLink('leitora@alexandria.com');
  const segundo = await pedirLink('leitora@alexandria.com');

  const res = await redefinir(segundo.body.resetToken, 'senhaNova123');
  assert.equal(res.statusCode, 200);
  assert.match(res.body.message, /Senha redefinida/);

  const usuario = await users.findByEmail('leitora@alexandria.com');
  assert.equal(await bcrypt.compare('senhaNova123', usuario.senha_hash), true);
  assert.equal(await bcrypt.compare('senhaAntiga1', usuario.senha_hash), false);

  // O link usado e o que tinha sido pedido antes dele param de valer
  assert.equal((await redefinir(segundo.body.resetToken, 'outraSenha123')).statusCode, 400);
  assert.equal((await redefinir(primeiro.body.resetToken, 'outraSenha123')).statusCode, 400);
});
