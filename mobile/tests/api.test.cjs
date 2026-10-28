const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createServices, json, session } = require('./helpers/services.cjs');

test('ambiente valida URL e normaliza barra sem depender de OpenLibrary', async () => {
  const h = createServices();
  assert.deepEqual(h.config.getApiConfig(), { baseUrl: 'http://localhost:3000', timeoutMs: 15000 });
  h.env.EXPO_PUBLIC_API_TIMEOUT = '2500';
  assert.equal(h.config.getApiConfig().timeoutMs, 2500);
  for (const timeout of ['0', '-1', 'NaN']) {
    h.env.EXPO_PUBLIC_API_TIMEOUT = timeout;
    assert.equal(h.config.getApiConfig().timeoutMs, 15000);
  }
  for (const url of ['', 'nao-e-url', 'file:///secret', 'https://user:pass@host', 'https://host/?key=x']) {
    h.env.EXPO_PUBLIC_API_URL = url;
    await assert.rejects(h.api.apiRequest('/test', { authenticated: false }), { kind: 'config' });
  }
  assert.equal(h.requests.length, 0);
});

test('não envia token para chamadas públicas nem aceita URL absoluta', async () => {
  const h = createServices();
  await h.session.saveAuth(session);
  h.fetch = async (_url, options) => {
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.headers['Content-Type'], 'application/json');
    assert.equal(options.body, 'false');
    return new Response(null, { status: 204 });
  };
  assert.equal(await h.api.apiRequest('/test', { method: 'POST', body: false, authenticated: false }), undefined);
  for (const path of ['https://other.test', '//other.test']) {
    await assert.rejects(h.api.apiRequest(path), { kind: 'config' });
  }
  assert.equal(h.requests.length, 1);
});

test('preserva erros de campo e status do backend', async () => {
  const h = createServices();
  h.fetch = async () => json({ message: 'Dados inválidos', errors: { email: 'Email inválido', extra: 4 } }, 422);
  await assert.rejects(h.api.apiRequest('/test', { authenticated: false }), (error) => {
    assert.equal(error.kind, 'validation');
    assert.equal(error.status, 422);
    assert.deepEqual(error.fieldErrors, { email: 'Email inválido' });
    return true;
  });
});

test('rejeita JSON inválido e sucesso vazio, preserva status em erros HTML', async () => {
  const h = createServices();
  for (const text of ['<html>Erro</html>', '']) {
    h.fetch = async () => new Response(text, { status: 200 });
    await assert.rejects(h.api.apiRequest('/test', { authenticated: false }), { kind: 'server', status: 200 });
  }
  h.fetch = async () => new Response('<html>Bad gateway</html>', { status: 502 });
  await assert.rejects(h.api.apiRequest('/test', { authenticated: false }), { kind: 'server', status: 502 });
});

test('timeout cobre conexão e leitura do corpo da resposta', async () => {
  for (const waitingForBody of [false, true]) {
    const h = createServices();
    h.fetch = async (_url, { signal }) => {
      const stalled = () => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      });
      return waitingForBody ? { ok: true, status: 200, text: stalled } : stalled();
    };
    await assert.rejects(h.api.apiRequest('/test', { authenticated: false, timeoutMs: 10 }), { kind: 'timeout' });
  }
});
