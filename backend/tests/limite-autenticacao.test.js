const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alexandria-limite-auth-'));

process.env.NODE_ENV = 'test';
process.env.DB_MODE = 'local';
process.env.LOCAL_DB_FILE = path.join(dataDir, 'users.json');
process.env.LOCAL_RESETS_FILE = path.join(dataDir, 'password-resets.json');
process.env.JWT_SECRET = 'segredo-do-teste-de-limite-de-autenticacao';
delete process.env.SMTP_USER;
delete process.env.SMTP_PASS;
delete process.env.BREVO_API_KEY;
delete process.env.RESET_TOKEN_TTL_MINUTES;
process.env.RESET_CODE_DEBUG = 'true';

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const bcrypt = require('bcrypt');
const express = require('express');

const limites = require('../src/middlewares/limitesDeAutenticacao');
const passwordResets = require('../src/repositories/passwordResetRepository');
const users = require('../src/repositories/userRepository');

const SENHA = 'Senha1234';
let servidor;
let endereco;

before(async () => {
  await users.initialize();
  await passwordResets.initialize();
  const senhaHash = await bcrypt.hash(SENHA, 4);
  for (const email of ['login@limite.test', 'outra@limite.test', 'codigo@limite.test', 'chute@limite.test']) {
    await users.create({ nome: 'Leitora', email, senhaHash });
  }

  const app = express();
  app.use(express.json());
  app.use('/api/auth', require('../src/routes/auth'));
  servidor = await new Promise((resolve) => {
    const aberto = app.listen(0, '127.0.0.1', () => resolve(aberto));
  });
  endereco = `http://127.0.0.1:${servidor.address().port}/api/auth`;
});

after(async () => {
  await new Promise((resolve) => servidor.close(resolve));
  fs.rmSync(dataDir, { recursive: true, force: true });
});

function entrar(email, senha) {
  return fetch(`${endereco}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, senha }),
  });
}

function respostaFalsa() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    set(nome, valor) {
      this.headers[nome] = valor;
      return this;
    },
    status(codigo) {
      this.statusCode = codigo;
      return this;
    },
    json(corpo) {
      this.body = corpo;
      return this;
    },
  };
}

async function chamar(cadeia, body) {
  const req = { body };
  const res = respostaFalsa();
  for (const etapa of cadeia) {
    let seguiu = false;
    await etapa(req, res, () => (seguiu = true));
    if (!seguiu) break;
  }
  return res;
}

function cadeiaDaRota(caminho) {
  const camada = require('../src/routes/auth').stack.find((item) => item.route?.path === caminho);
  return camada.route.stack.map((item) => item.handle);
}

const pedirCodigo = (email) => chamar(cadeiaDaRota('/forgot-password'), { email });
const redefinir = (email, codigo) => chamar(cadeiaDaRota('/reset-password'), { email, codigo, senha: 'Nova12345' });

test('o login bloqueia o e-mail depois de 10 tentativas, com aviso em minutos, e não afeta outro e-mail', async () => {
  for (let i = 0; i < 10; i += 1) assert.equal((await entrar('LOGIN@limite.test ', 'errada1')).status, 401);

  const bloqueada = await entrar('login@limite.test', SENHA);
  assert.equal(bloqueada.status, 429);
  assert.ok(Number(bloqueada.headers.get('retry-after')) > 14 * 60);
  assert.equal((await bloqueada.json()).error, 'Muitas tentativas de entrar com este e-mail. Tente de novo em 15 minutos.');

  assert.equal((await entrar('outra@limite.test', SENHA)).status, 200);
});

test('pedir código tem intervalo de 1 minuto e máximo de 5 por hora', async (t) => {
  let relogio = 5_000_000;
  t.mock.method(performance, 'now', () => relogio);

  assert.equal((await pedirCodigo('codigo@limite.test')).statusCode, 200);
  const logoDepois = await pedirCodigo('codigo@limite.test');
  assert.equal(logoDepois.statusCode, 429);
  assert.equal(logoDepois.body.error, 'Você acabou de pedir um código. Tente de novo em 1 minuto.');

  for (let i = 0; i < 4; i += 1) {
    relogio += 61_000;
    assert.equal((await pedirCodigo('codigo@limite.test')).statusCode, 200);
  }
  relogio += 61_000;
  const sexto = await pedirCodigo('codigo@limite.test');
  assert.equal(sexto.statusCode, 429);
  assert.match(sexto.body.error, /^Você pediu muitos códigos\. Tente de novo em \d+ minutos\.$/);
});

test('pedir um código novo não devolve as tentativas: o 11º chute na hora é barrado mesmo com o código certo', async (t) => {
  let relogio = 50_000_000;
  t.mock.method(performance, 'now', () => relogio);

  await pedirCodigo('chute@limite.test');
  for (let i = 0; i < 5; i += 1) assert.equal((await redefinir('chute@limite.test', '000000')).statusCode, 400);

  relogio += 61_000;
  await pedirCodigo('chute@limite.test');
  for (let i = 0; i < 5; i += 1) assert.equal((await redefinir('chute@limite.test', '000000')).statusCode, 400);

  relogio += 61_000;
  const { resetCode } = (await pedirCodigo('chute@limite.test')).body;
  const certo = await redefinir('chute@limite.test', resetCode);
  assert.equal(certo.statusCode, 429);
  assert.match(certo.body.error, /^Muitas tentativas de redefinir a senha\. Tente de novo em \d+ minutos\.$/);
});

test('sem e-mail no corpo o limite não conta, e a validação do controller responde', async () => {
  for (let i = 0; i < 12; i += 1) assert.equal((await entrar('', SENHA)).status, 400);
});

test('a espera aparece em segundos abaixo de 1 minuto e em minutos a partir dele', () => {
  assert.equal(limites.espera(1), '1 segundo');
  assert.equal(limites.espera(59), '59 segundos');
  assert.equal(limites.espera(60), '1 minuto');
  assert.equal(limites.espera(61), '2 minutos');
});
