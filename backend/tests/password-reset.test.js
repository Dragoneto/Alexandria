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

const EMAIL = 'leitora@alexandria.com';

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

async function pedirCodigo(email) {
  const res = fakeResponse();
  await forgotPassword({ body: { email } }, res);
  return res;
}

async function redefinir(codigo, senha, email = EMAIL) {
  const res = fakeResponse();
  await resetPassword({ body: { email, codigo, senha } }, res);
  return res;
}

before(async () => {
  await users.initialize();
  await passwordResets.initialize();

  const res = fakeResponse();
  await register({ body: { nome: 'Leitora', email: EMAIL, senha: 'senhaAntiga1' } }, res);
  assert.equal(res.statusCode, 201);
});

after(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('pedido sem e-mail é recusado', async () => {
  const res = await pedirCodigo('   ');
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /Email/);
});

test('e-mail sem conta recebe a mesma resposta, e sem código', async () => {
  const res = await pedirCodigo('ninguem@alexandria.com');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.resetCode, undefined);
  assert.match(res.body.message, /Se existir uma conta/);
});

test('e-mail com conta recebe um código de 6 dígitos, e o código não fica salvo em texto', async () => {
  const res = await pedirCodigo('LEITORA@alexandria.com');

  assert.equal(res.statusCode, 200);
  assert.match(res.body.message, /código de 6 dígitos/);
  assert.match(res.body.resetCode, /^\d{6}$/);

  const salvo = fs.readFileSync(process.env.LOCAL_RESETS_FILE, 'utf8');
  assert.ok(!salvo.includes(`"${res.body.resetCode}"`), 'o código não pode ser gravado em texto puro');
});

test('senha curta não redefine', async () => {
  const { body } = await pedirCodigo(EMAIL);
  const res = await redefinir(body.resetCode, 'curta12');

  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /pelo menos 8 caracteres/);
});

test('senha sem letra ou sem número não redefine', async () => {
  const { body } = await pedirCodigo(EMAIL);

  for (const senha of ['somenteletras', '123456789']) {
    const res = await redefinir(body.resetCode, senha);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /com letra e número/);
  }
});

test('cadastro recusa senha fraca e não cria a conta', async () => {
  for (const senha of ['curta1', 'somenteletras', '123456789']) {
    const res = fakeResponse();
    await register({ body: { nome: 'Fraca', email: 'fraca@alexandria.com', senha } }, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /pelo menos 8 caracteres, com letra e número/);
  }

  assert.equal(await users.findByEmail('fraca@alexandria.com'), null);
});

test('código fora do formato ou de outro e-mail não redefine', async () => {
  const { body } = await pedirCodigo(EMAIL);

  for (const codigo of ['', '12345', '1234567', 'abcdef']) {
    const res = await redefinir(codigo, 'senhaNova123');
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /Código inválido ou expirado/);
  }

  const res = await redefinir(body.resetCode, 'senhaNova123', 'ninguem@alexandria.com');
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /Código inválido ou expirado/);
});

test('código vencido não redefine', async () => {
  const usuario = await users.findByEmail(EMAIL);

  await passwordResets.invalidateForUser(usuario.id);
  await passwordResets.create({
    userId: usuario.id,
    token: '123456',
    expiraEm: new Date(Date.now() - 1000),
  });

  const res = await redefinir('123456', 'senhaNova123');
  assert.equal(res.statusCode, 400);
});

test('pedir de novo derruba o código anterior', async () => {
  const primeiro = await pedirCodigo(EMAIL);
  await pedirCodigo(EMAIL);

  const res = await redefinir(primeiro.body.resetCode, 'senhaNova123');
  assert.equal(res.statusCode, 400);
});

test('depois de cinco tentativas erradas, nem o código certo vale', async () => {
  const { body } = await pedirCodigo(EMAIL);
  const errado = body.resetCode === '000000' ? '000001' : '000000';

  for (let tentativa = 1; tentativa <= 5; tentativa += 1) {
    const res = await redefinir(errado, 'senhaNova123');
    assert.equal(res.statusCode, 400);
  }

  assert.equal((await redefinir(body.resetCode, 'senhaNova123')).statusCode, 400);
});

test('código certo troca a senha e não vale de novo', async () => {
  const { body } = await pedirCodigo(EMAIL);

  const res = await redefinir(body.resetCode, 'senhaNova123');
  assert.equal(res.statusCode, 200);
  assert.match(res.body.message, /Senha redefinida/);

  const usuario = await users.findByEmail(EMAIL);
  assert.equal(await bcrypt.compare('senhaNova123', usuario.senha_hash), true);
  assert.equal(await bcrypt.compare('senhaAntiga1', usuario.senha_hash), false);

  assert.equal((await redefinir(body.resetCode, 'outraSenha123')).statusCode, 400);
});
