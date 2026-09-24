const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createServices, json } = require('./helpers/services.cjs');

const SENHA_VALIDA = 'senhaNova123';

test('recusa antes de chamar a API o que o backend recusaria', async () => {
  const h = createServices();

  await assert.rejects(
    h.auth.resetPassword({ token: '   ', password: SENHA_VALIDA, confirmation: SENHA_VALIDA }),
    { kind: 'validation' },
  );
  await assert.rejects(
    h.auth.resetPassword({ token: 'token-do-link', password: 'curta12', confirmation: 'curta12' }),
    { kind: 'validation', message: /pelo menos 8 caracteres/ },
  );
  await assert.rejects(
    h.auth.resetPassword({
      token: 'token-do-link',
      password: SENHA_VALIDA,
      confirmation: 'outraSenha99',
    }),
    { kind: 'validation', message: /não coincidem/ },
  );

  assert.equal(h.requests.length, 0);
});

test('envia o token sem espaços e a senha para a rota pública', async () => {
  const h = createServices();

  h.fetch = async (url, options) => {
    assert.equal(url, 'http://localhost:3000/api/auth/reset-password');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, undefined);
    assert.deepEqual(JSON.parse(options.body), {
      token: 'token-do-link',
      senha: SENHA_VALIDA,
    });
    return json({ message: 'Senha redefinida com sucesso!' });
  };

  assert.equal(
    await h.auth.resetPassword({
      token: '  token-do-link  ',
      password: SENHA_VALIDA,
      confirmation: SENHA_VALIDA,
    }),
    undefined,
  );
  assert.equal(h.requests.length, 1);
});

test('link vencido no backend vira mensagem de validação na tela', async () => {
  const h = createServices();
  h.fetch = async () => json({ error: 'Link inválido ou expirado. Peça um novo.' }, 400);

  await assert.rejects(
    h.auth.resetPassword({
      token: 'token-vencido',
      password: SENHA_VALIDA,
      confirmation: SENHA_VALIDA,
    }),
    { kind: 'validation', message: /Link inválido ou expirado/ },
  );
});

test('resposta sem message é tratada como falha do servidor', async () => {
  const h = createServices();
  h.fetch = async () => json({ resultado: 'ok' });

  await assert.rejects(
    h.auth.resetPassword({
      token: 'token-do-link',
      password: SENHA_VALIDA,
      confirmation: SENHA_VALIDA,
    }),
    { kind: 'server' },
  );
});
