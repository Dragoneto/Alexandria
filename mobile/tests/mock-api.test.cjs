const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');

const { createMockApi } = require('../mock-api/server.js');

const REGISTERED_EMAIL = 'leitor@alexandria.com';
const SENHA_VALIDA = 'senhaNova123';

let server;
let baseUrl;

/** Sobe o mock numa porta livre, sem espera e sem log, para o teste ser rápido. */
before(async () => {
  server = createMockApi({ delayMs: 0, slowDelayMs: 0, log: () => {} });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function post(path, body, url = baseUrl) {
  const response = await fetch(`${url}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return { status: response.status, body: await response.json() };
}

function pedirLink(email) {
  return post('/api/auth/forgot-password', { email });
}

function redefinir(token, senha) {
  return post('/api/auth/reset-password', { token, senha });
}

test('conta cadastrada recebe o token e um link que abre o app', async () => {
  const { status, body } = await pedirLink(` ${REGISTERED_EMAIL.toUpperCase()} `);

  assert.equal(status, 200);
  assert.match(body.message, /Se existir uma conta/);
  assert.equal(body.resetUrl, `alexandriamobile://redefinir-senha?token=${body.resetToken}`);
});

test('e-mail sem conta recebe a mesma resposta, e sem token', async () => {
  const { status, body } = await pedirLink('ninguem@alexandria.com');

  assert.equal(status, 200);
  assert.equal(body.resetToken, undefined);
  assert.match(body.message, /Se existir uma conta/);
});

test('e-mail vazio e erro interno seguem o formato do backend', async () => {
  assert.deepEqual(await pedirLink('   '), {
    status: 400,
    body: { error: 'Email é obrigatório' },
  });
  assert.deepEqual(await pedirLink('erro500@alexandria.com'), {
    status: 500,
    body: { error: 'Erro interno do servidor' },
  });
});

test('senha curta é recusada e não gasta o link', async () => {
  const { body } = await pedirLink(REGISTERED_EMAIL);

  const recusado = await redefinir(body.resetToken, 'curta12');
  assert.equal(recusado.status, 400);
  assert.match(recusado.body.error, /pelo menos 8 caracteres/);

  const aceito = await redefinir(body.resetToken, SENHA_VALIDA);
  assert.equal(aceito.status, 200);
  assert.match(aceito.body.message, /Senha redefinida/);
});

test('o link só vale uma vez, e token desconhecido não passa', async () => {
  const { body } = await pedirLink(REGISTERED_EMAIL);

  assert.equal((await redefinir(body.resetToken, SENHA_VALIDA)).status, 200);

  const reuso = await redefinir(body.resetToken, SENHA_VALIDA);
  assert.equal(reuso.status, 400);
  assert.match(reuso.body.error, /Link inválido ou expirado/);

  assert.equal((await redefinir('nao-existe', SENHA_VALIDA)).status, 400);
  assert.equal((await redefinir('   ', SENHA_VALIDA)).status, 400);
});

test('rota fora do contrato responde 404 no formato do backend', async () => {
  const response = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', body: '{}' });

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'Rota não disponível no mock' });
});

test('a requisição de verificação do navegador é liberada', async () => {
  const response = await fetch(`${baseUrl}/api/auth/reset-password`, { method: 'OPTIONS' });

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
});

test('o e-mail lento demora mais que os outros, para testar o limite de espera do app', async () => {
  const lento = createMockApi({ delayMs: 0, slowDelayMs: 80, log: () => {} });
  await new Promise((resolve) => lento.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${lento.address().port}`;

  try {
    const inicio = Date.now();
    await post('/api/auth/forgot-password', { email: 'lento@alexandria.com' }, url);
    assert.ok(Date.now() - inicio >= 70, 'deveria esperar o tempo configurado');
  } finally {
    await new Promise((resolve) => lento.close(resolve));
  }
});
