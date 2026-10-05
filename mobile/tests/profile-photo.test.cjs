const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createServices, json, session } = require('./helpers/services.cjs');

const FOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRg';

async function logado() {
  const h = createServices();
  await h.session.saveAuth(session);
  return h;
}

test('busca a foto com o token da sessão', async () => {
  const h = await logado();
  h.fetch = async (url, options) => {
    assert.equal(url, 'http://localhost:3000/api/auth/profile/photo');
    assert.equal(options.method, 'GET');
    assert.equal(options.headers.Authorization, `Bearer ${session.token}`);
    return json({ foto: FOTO });
  };
  assert.equal(await h.auth.getProfilePhoto(), FOTO);
  h.fetch = async () => json({ foto: null });
  assert.equal(await h.auth.getProfilePhoto(), null);
});

test('envia a foto como data URI JPEG e devolve a salva', async () => {
  const h = await logado();
  h.fetch = async (url, options) => {
    assert.equal(options.method, 'PUT');
    assert.deepEqual(JSON.parse(options.body), { foto: FOTO });
    return json({ message: 'Foto de perfil atualizada!', foto: FOTO });
  };
  assert.equal(await h.auth.saveProfilePhoto('/9j/4AAQSkZJRg'), FOTO);
});

test('foto vazia não chega a chamar a API', async () => {
  const h = await logado();
  await assert.rejects(h.auth.saveProfilePhoto(''), { kind: 'validation' });
  assert.equal(h.requests.length, 0);
});

test('remove a foto com DELETE', async () => {
  const h = await logado();
  h.fetch = async (url, options) => {
    assert.equal(url, 'http://localhost:3000/api/auth/profile/photo');
    assert.equal(options.method, 'DELETE');
    return json({ message: 'Foto de perfil removida!', foto: null });
  };
  await h.auth.removeProfilePhoto();
  assert.equal(h.requests.length, 1);
});

test('resposta que não é imagem vira erro do servidor', async () => {
  const h = await logado();
  for (const foto of ['https://exemplo.com/foto.jpg', 42, undefined]) {
    h.fetch = async () => json({ foto });
    await assert.rejects(h.auth.getProfilePhoto(), { kind: 'server' });
  }
});

test('foto grande demais mostra a mensagem do backend', async () => {
  const h = await logado();
  h.fetch = async () => json({ error: 'A foto é grande demais' }, 413);
  await assert.rejects(h.auth.saveProfilePhoto('/9j/4AAQ'), { message: 'A foto é grande demais' });
});
