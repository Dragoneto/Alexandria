const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createServices, json, user, session } = require('./helpers/services.cjs');

for (const os of ['android', 'web']) {
  test(`${os}: cadastro, login, perfil, restauração e logout`, async () => {
    const h = createServices({ os });
    const events = [];
    const unsubscribe = h.session.subscribeAuth((value) => events.push(value));
    h.fetch = async (url, options) => {
      assert.equal(options.headers.Accept, 'application/json');
      if (url.endsWith('/register')) {
        assert.equal(options.headers.Authorization, undefined);
        assert.deepEqual(JSON.parse(options.body), { nome: 'Davi', email: user.email, senha: 'senha-teste' });
        return json({ user }, 201);
      }
      if (url.endsWith('/login')) {
        assert.equal(options.headers.Authorization, undefined);
        assert.deepEqual(JSON.parse(options.body), { email: user.email, senha: 'senha-teste' });
        return json({ user, token: session.token });
      }
      assert.equal(url, 'http://localhost:3000/api/auth/profile');
      assert.equal(options.headers.Authorization, `Bearer ${session.token}`);
      assert.equal(options.method, 'GET');
      return json({ user });
    };
    assert.deepEqual(await h.auth.registerUser({ name: ' Davi ', email: ` ${user.email} `, password: 'senha-teste', confirmation: 'senha-teste' }), { id: 7, name: 'Davi', email: user.email });
    assert.equal(await h.session.getAuth(), null);
    assert.deepEqual(await h.auth.loginUser(user.email, 'senha-teste'), session);
    assert.deepEqual(await h.auth.getProfile(), { id: 7, name: 'Davi', email: user.email });
    const reopened = createServices({ os, storage: h.storage });
    reopened.fetch = h.fetch;
    assert.deepEqual(await reopened.auth.restoreSession(), session);
    await h.auth.logoutUser();
    assert.equal(await h.session.getAuth(), null);
    assert.equal(await reopened.auth.restoreSession(), null);
    await assert.rejects(h.auth.getProfile(), { kind: 'auth', status: 401 });
    assert.deepEqual(events, [session, null]);
    unsubscribe();
  });
}

test('validação impede cadastro inconsistente e login vazio', async () => {
  const h = createServices();
  await assert.rejects(h.auth.registerUser({ name: ' ', email: user.email, password: 'a', confirmation: 'a' }), { kind: 'validation' });
  await assert.rejects(h.auth.registerUser({ name: 'Davi', email: user.email, password: 'a', confirmation: 'b' }), /senhas não coincidem/);
  await assert.rejects(h.auth.loginUser('invalido', 'senha'), { kind: 'validation' });
  await assert.rejects(h.auth.loginUser(user.email, ''), { kind: 'validation' });
  assert.equal(h.requests.length, 0);
});

test('senha incorreta e usuário duplicado mostram erros sem criar sessão', async () => {
  const h = createServices();
  h.fetch = async () => json({ error: 'Email ou senha incorretos' }, 401);
  await assert.rejects(h.auth.loginUser(user.email, 'incorreta'), { status: 401, message: 'Email ou senha incorretos' });
  assert.equal(await h.session.getAuth(), null);
  h.fetch = async () => json({ error: 'Este email já está cadastrado' }, 409);
  await assert.rejects(h.auth.registerUser({ name: 'Davi', email: user.email, password: 'a', confirmation: 'a' }), { kind: 'validation', status: 409 });
});

test('login recusa respostas sem token, com token mock ou usuário inválido', async () => {
  for (const response of [{ user }, { user, token: 'mock-token' }, { user: {}, token: 'token' }, null]) {
    const h = createServices();
    h.fetch = async () => json(response);
    await assert.rejects(h.auth.loginUser(user.email, 'senha'), { kind: 'server' });
    assert.equal(await h.session.getAuth(), null);
  }
});

test('recuperação chama endpoint real e propaga sua indisponibilidade', async () => {
  const h = createServices();
  h.fetch = async (url, options) => {
    assert.equal(url, 'http://localhost:3000/api/auth/forgot-password');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, undefined);
    assert.deepEqual(JSON.parse(options.body), { email: user.email });
    return json({ message: 'Solicitação recebida' });
  };
  await h.auth.forgotPassword(` ${user.email} `);
  h.fetch = async () => new Response('Cannot POST /api/auth/forgot-password', { status: 404 });
  await assert.rejects(h.auth.forgotPassword(user.email), { status: 404 });
});

test('sessão corrompida e antiga sessão mock são descartadas', async () => {
  for (const raw of ['{', 'null', '{}', JSON.stringify({ ...session, token: 'mock-token' })]) {
    const h = createServices({ storage: new Map([['alexandria_auth', raw]]) });
    assert.equal(await h.auth.restoreSession(), null);
    assert.equal(h.storage.size, 0);
    assert.equal(h.requests.length, 0);
  }
});

test('401 ou usuário removido encerra a sessão durante restauração', async () => {
  for (const status of [401, 404]) {
    const h = createServices();
    await h.session.saveAuth(session);
    h.fetch = async () => json({ error: 'Sessão indisponível' }, status);
    assert.equal(await h.auth.restoreSession(), null);
    assert.equal(await h.session.getAuth(), null);
  }
});

test('falha de rede não apaga a sessão salva', async () => {
  const h = createServices();
  await h.session.saveAuth(session);
  await assert.rejects(h.auth.restoreSession(), { kind: 'network' });
  assert.deepEqual(await h.session.getAuth(), session);
});

test('restauração em andamento não desfaz logout', async () => {
  const h = createServices();
  await h.session.saveAuth(session);
  let complete;
  h.fetch = () => new Promise((resolve) => { complete = resolve; });
  const restoring = h.auth.restoreSession();
  await new Promise(setImmediate);
  await h.auth.logoutUser();
  complete(json({ user }));
  assert.equal(await restoring, null);
  assert.equal(await h.session.getAuth(), null);
});

test('401 de requisição antiga não apaga uma nova sessão', async () => {
  const h = createServices();
  await h.session.saveAuth(session);
  let complete;
  h.fetch = () => new Promise((resolve) => { complete = resolve; });
  const profile = h.auth.getProfile();
  await new Promise(setImmediate);
  const newer = { ...session, token: 'nova-sessao' };
  await h.session.saveAuth(newer);
  complete(json({ error: 'Expirado' }, 401));
  await assert.rejects(profile, { status: 401 });
  assert.deepEqual(await h.session.getAuth(), newer);
});
