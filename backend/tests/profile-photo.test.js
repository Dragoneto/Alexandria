const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alexandria-foto-'));

process.env.NODE_ENV = 'test';
process.env.DB_MODE = 'local';
process.env.LOCAL_DB_FILE = path.join(dataDir, 'users.json');
process.env.LOCAL_RESETS_FILE = path.join(dataDir, 'password-resets.json');
process.env.JWT_SECRET = 'segredo-de-teste';

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');

const {
  deletePhoto,
  getPhoto,
  getProfile,
  register,
  updatePhoto,
  updateProfile,
} = require('../src/controllers/authController');
const users = require('../src/repositories/userRepository');

const FOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgK';
let usuarioId;

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

async function chamar(handler, body, id = usuarioId) {
  const res = fakeResponse();
  await handler({ body, user: { id } }, res);
  return res;
}

before(async () => {
  await users.initialize();
  const res = fakeResponse();
  await register(
    { body: { nome: 'Leitora', email: 'leitora@alexandria.com', senha: 'senhaForte1' } },
    res,
  );
  assert.equal(res.statusCode, 201);
  usuarioId = res.body.user.id;
});

after(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('conta nova começa sem foto', async () => {
  const res = await chamar(getPhoto);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.foto, null);
});

test('recusa o que não é imagem em base64', async () => {
  for (const foto of [
    undefined,
    '',
    'https://exemplo.com/foto.jpg',
    'data:image/gif;base64,R0lGODlh',
    'data:text/html;base64,PGh0bWw+',
    'data:image/jpeg;base64,<script>',
  ]) {
    const res = await chamar(updatePhoto, { foto });
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /JPG, PNG ou WebP/);
  }
});

test('recusa foto grande demais', async () => {
  const res = await chamar(updatePhoto, { foto: `data:image/png;base64,${'A'.repeat(310 * 1024)}` });
  assert.equal(res.statusCode, 413);
  assert.match(res.body.error, /grande demais/);
});

test('salva, devolve e remove a foto', async () => {
  const salva = await chamar(updatePhoto, { foto: FOTO });
  assert.equal(salva.statusCode, 200);
  assert.equal(salva.body.foto, FOTO);

  assert.equal((await chamar(getPhoto)).body.foto, FOTO);

  const removida = await chamar(deletePhoto);
  assert.equal(removida.statusCode, 200);
  assert.equal(removida.body.foto, null);
  assert.equal((await chamar(getPhoto)).body.foto, null);
});

test('a foto não vaza no perfil nem depois de editar o perfil', async () => {
  await chamar(updatePhoto, { foto: FOTO });

  const perfil = await chamar(getProfile);
  assert.equal(perfil.statusCode, 200);
  assert.equal(perfil.body.user.foto, undefined);

  const editado = await chamar(updateProfile, { nome: 'Leitora Nova', email: 'leitora@alexandria.com' });
  assert.equal(editado.statusCode, 200);
  assert.equal(editado.body.user.foto, undefined);

  assert.equal((await chamar(getPhoto)).body.foto, FOTO);
});

test('usuário inexistente recebe 404', async () => {
  assert.equal((await chamar(getPhoto, undefined, 9999)).statusCode, 404);
  assert.equal((await chamar(updatePhoto, { foto: FOTO }, 9999)).statusCode, 404);
  assert.equal((await chamar(deletePhoto, undefined, 9999)).statusCode, 404);
});
