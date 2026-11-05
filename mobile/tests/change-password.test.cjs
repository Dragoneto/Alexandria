const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createServices, json, session } = require('./helpers/services.cjs');

const SENHA_ATUAL = 'senhaAntiga1';
const SENHA_NOVA = 'senhaNova123';

/** Pedido válido; cada teste troca só o campo que quer testar. */
function pedido(campos = {}) {
  return {
    currentPassword: SENHA_ATUAL,
    password: SENHA_NOVA,
    confirmation: SENHA_NOVA,
    ...campos,
  };
}

async function comSessao() {
  const h = createServices();
  await h.session.saveAuth(session);
  return h;
}

test('recusa antes de chamar a API o que o backend recusaria', async () => {
  const h = await comSessao();

  await assert.rejects(h.auth.changePassword(pedido({ currentPassword: '' })), {
    kind: 'validation',
    message: /senha atual/,
  });
  for (const password of ['curta12', 'somenteletras', '123456789']) {
    await assert.rejects(h.auth.changePassword(pedido({ password, confirmation: password })), {
      kind: 'validation',
      message: /pelo menos 8 caracteres, com letra e número/,
    });
  }
  await assert.rejects(h.auth.changePassword(pedido({ confirmation: 'outraSenha99' })), {
    kind: 'validation',
    message: /não coincidem/,
  });

  assert.equal(h.requests.length, 0);
});

test('envia só as duas senhas, com o token da sessão, e não encerra a sessão do aparelho', async () => {
  const h = await comSessao();
  h.fetch = async (url, options) => {
    assert.equal(url, 'http://localhost:3000/api/auth/password');
    assert.equal(options.method, 'PUT');
    assert.equal(options.headers.Authorization, `Bearer ${session.token}`);
    assert.deepEqual(JSON.parse(options.body), { senhaAtual: SENHA_ATUAL, novaSenha: SENHA_NOVA });
    return json({ message: 'Senha alterada com sucesso!' });
  };

  assert.equal(await h.auth.changePassword(pedido()), undefined);

  assert.equal(h.requests.length, 1);
  assert.deepEqual(await h.session.getAuth(), session);
});

test('senha atual incorreta vira erro de validação no campo e mantém a sessão', async () => {
  const h = await comSessao();
  const mensagem = 'A senha atual está incorreta';
  h.fetch = async () => json({ error: mensagem, errors: { senhaAtual: mensagem } }, 400);

  await assert.rejects(h.auth.changePassword(pedido()), {
    kind: 'validation',
    status: 400,
    message: mensagem,
    fieldErrors: { senhaAtual: mensagem },
  });

  assert.deepEqual(await h.session.getAuth(), session);
});

test('sessão expirada no backend vira erro de autenticação e sai do aparelho', async () => {
  const h = await comSessao();
  h.fetch = async () => json({ error: 'Token inválido ou expirado' }, 401);

  await assert.rejects(h.auth.changePassword(pedido()), { kind: 'auth', status: 401 });

  assert.equal(await h.session.getAuth(), null);
});

test('sem sessão no aparelho nem chega a chamar a API', async () => {
  const h = createServices();

  await assert.rejects(h.auth.changePassword(pedido()), { kind: 'auth', status: 401 });

  assert.equal(h.requests.length, 0);
});

test('resposta sem message é tratada como falha do servidor', async () => {
  const h = await comSessao();
  h.fetch = async () => json({ resultado: 'ok' });

  await assert.rejects(h.auth.changePassword(pedido()), { kind: 'server' });
});
