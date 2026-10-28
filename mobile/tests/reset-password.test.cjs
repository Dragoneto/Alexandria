const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createServices, json } = require('./helpers/services.cjs');

const EMAIL = 'leitora@alexandria.com';
const CODIGO = '042137';
const SENHA_VALIDA = 'senhaNova123';

/** Pedido válido; cada teste troca só o campo que quer testar. */
function pedido(campos = {}) {
  return {
    email: EMAIL,
    code: CODIGO,
    password: SENHA_VALIDA,
    confirmation: SENHA_VALIDA,
    ...campos,
  };
}

test('recusa antes de chamar a API o que o backend recusaria', async () => {
  const h = createServices();

  await assert.rejects(h.auth.resetPassword(pedido({ email: 'sem-arroba' })), {
    kind: 'validation',
    message: /e-mail válido/,
  });
  for (const code of ['   ', '12345', '1234567', 'abcdef']) {
    await assert.rejects(h.auth.resetPassword(pedido({ code })), {
      kind: 'validation',
      message: /código de 6 dígitos/,
    });
  }
  await assert.rejects(
    h.auth.resetPassword(pedido({ password: 'curta12', confirmation: 'curta12' })),
    { kind: 'validation', message: /pelo menos 8 caracteres/ },
  );
  for (const password of ['somenteletras', '123456789']) {
    await assert.rejects(h.auth.resetPassword(pedido({ password, confirmation: password })), {
      kind: 'validation',
      message: /com letra e número/,
    });
  }
  await assert.rejects(h.auth.resetPassword(pedido({ confirmation: 'outraSenha99' })), {
    kind: 'validation',
    message: /não coincidem/,
  });

  assert.equal(h.requests.length, 0);
});

test('envia e-mail, código e senha sem espaços nas pontas para a rota pública', async () => {
  const h = createServices();

  h.fetch = async (url, options) => {
    assert.equal(url, 'http://localhost:3000/api/auth/reset-password');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, undefined);
    assert.deepEqual(JSON.parse(options.body), {
      email: EMAIL,
      codigo: CODIGO,
      senha: SENHA_VALIDA,
    });
    return json({ message: 'Senha redefinida com sucesso!' });
  };

  assert.equal(
    await h.auth.resetPassword(pedido({ email: `  ${EMAIL} `, code: ` ${CODIGO} ` })),
    undefined,
  );
  assert.equal(h.requests.length, 1);
});

test('código errado ou vencido no backend vira mensagem de validação na tela', async () => {
  const h = createServices();
  h.fetch = async () => json({ error: 'Código inválido ou expirado. Peça um novo.' }, 400);

  await assert.rejects(h.auth.resetPassword(pedido()), {
    kind: 'validation',
    message: /Código inválido ou expirado/,
  });
});

test('resposta sem message é tratada como falha do servidor', async () => {
  const h = createServices();
  h.fetch = async () => json({ resultado: 'ok' });

  await assert.rejects(h.auth.resetPassword(pedido()), { kind: 'server' });
});
