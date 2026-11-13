const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { before, test } = require('node:test');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alexandria-notificacoes-'));
Object.assign(process.env, {
  DB_MODE: 'local', LOCAL_DB_FILE: path.join(dir, 'users.json'),
  LOCAL_REVIEWS_FILE: path.join(dir, 'reviews.json'), LOCAL_COMMENTS_FILE: path.join(dir, 'comments.json'),
  LOCAL_NOTIFICATIONS_FILE: path.join(dir, 'notifications.json'),
  JWT_SECRET: 'segredo-isolado-dos-testes',
});
const users = require('../src/repositories/userRepository');
const reviews = require('../src/repositories/avaliacaoRepository');
const comments = require('../src/repositories/comentarioRepository');
const notifications = require('../src/repositories/notificacaoRepository');
const commentController = require('../src/controllers/comentarioController');
const controller = require('../src/controllers/notificacaoController');
const { context } = require('../src/controllers/comentarioContextoController');
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
let author, reader, third, review;
before(async () => {
  await users.initialize(); await reviews.initialize(); await comments.initialize();
  [author, reader, third] = await Promise.all(['author', 'reader', 'third'].map((name) => users.create({ nome: name, email: `${name}@example.test`, senhaHash: 'test' })));
  review = await reviews.create({ userId: author.id, livro: { id: 'OL1W', titulo: 'Livro', autores: [] }, nota: 4, resenha: 'Uma boa leitura.' });
});
async function post(user, text, parent, key) {
  const res = response();
  await commentController.create({ user, params: { id: String(review.id) }, headers: key ? { 'idempotency-key': key } : {}, body: { texto: text, paiId: parent } }, res);
  assert.equal(res.code, 201);
  return res.body.comentario;
}
async function list(user, query = {}) {
  const res = response(); await controller.list({ user, query }, res); return res;
}

test('destinatários, respostas e ausência de autonotificação', async () => {
  const root = await post(reader, 'Primeiro comentário');
  assert.equal(await notifications.unread(author.id), 1);
  assert.equal(await notifications.unread(reader.id), 0);
  await post(third, 'Resposta ao leitor', root.id);
  assert.equal(await notifications.unread(author.id), 2);
  assert.equal(await notifications.unread(reader.id), 1);
  assert.equal(await notifications.unread(third.id), 0);
  await post(author, 'Resposta da autora', root.id);
  assert.equal(await notifications.unread(author.id), 2);
  assert.equal(await notifications.unread(reader.id), 2);
});

test('destinatário que é autor da avaliação e do pai recebe apenas uma resposta', async () => {
  const root = await post(author, 'Comentário da autora');
  const before = await notifications.unread(author.id);
  await post(reader, 'Resposta para a autora', root.id);
  assert.equal(await notifications.unread(author.id), before + 1);
});

test('reenvios concorrentes e recuperação repetida não duplicam notificações', async () => {
  const before = await notifications.unread(author.id);
  const results = await Promise.all([post(reader, 'Mesmo envio', null, 'idempotency-test-001'), post(reader, 'Mesmo envio', null, 'idempotency-test-001')]);
  assert.equal(results[0].id, results[1].id);
  await notifications.recover(); await notifications.recover();
  assert.equal(await notifications.unread(author.id), before + 1);
});

test('falha ao materializar notificações preserva o evento para recuperação', async () => {
  const temporary = `${process.env.LOCAL_NOTIFICATIONS_FILE}.tmp`;
  fs.mkdirSync(temporary);
  await post(reader, 'Mensagem gravada antes da falha');
  await assert.rejects(notifications.recover());
  fs.rmdirSync(temporary);
  await notifications.recover();
  const rows = (await list(author)).body.notificacoes;
  assert.ok(rows.length > 0);
  const persisted = JSON.parse(fs.readFileSync(process.env.LOCAL_NOTIFICATIONS_FILE, 'utf8'));
  assert.ok(persisted.some((r) => r.comentario_id === JSON.parse(fs.readFileSync(process.env.LOCAL_COMMENTS_FILE, 'utf8')).at(-1).id));
});

test('listagem privada, cursor sem repetição e leitura idempotente', async () => {
  const first = await list(author, { limit: '2' });
  assert.equal(first.body.notificacoes.length, 2);
  // O título do livro vai junto para a notificação dizer onde foi o comentário
  assert.ok(first.body.notificacoes.every((n) => n.livroTitulo === 'Livro'));
  assert.ok(first.body.proximoCursor);
  const second = await list(author, { limit: '2', cursor: first.body.proximoCursor });
  assert.ok(second.body.notificacoes.every((n) => !first.body.notificacoes.some((a) => a.id === n.id)));
  assert.ok(!JSON.stringify(first.body).includes('@example.test'));
  assert.ok(!JSON.stringify(first.body).includes('senha'));
  const id = first.body.notificacoes[0].id;
  const denied = response(); await controller.markRead({ user: third, params: { id } }, denied);
  assert.equal(denied.code, 404);
  assert.equal(await notifications.markRead(author.id, id), 1);
  assert.equal(await notifications.markRead(author.id, id), 1);
  await notifications.markRead(author.id);
  assert.equal(await notifications.unread(author.id), 0);
  assert.ok(await notifications.unread(reader.id) > 0);
  assert.equal((await list(author, { cursor: 'invalid' })).code, 400);
  assert.equal((await list(author, { limit: '999' })).code, 400);
});

test('contexto limitado, ancestrais e rejeição de avaliação errada', async () => {
  const root = await post(reader, 'Raiz do contexto');
  const target = await post(third, 'Alvo do contexto', root.id);
  for (let i = 0; i < 22; i++) await post(reader, `Comentário seguinte ${i}`);
  const res = response();
  await context({ user: author, params: { id: String(review.id), comentarioId: String(target.id) }, query: {} }, res);
  assert.equal(res.code, 200);
  assert.deepEqual(res.body.ancestrais.map((c) => c.id), [root.id]);
  assert.equal(res.body.comentarios.length, 20);
  assert.equal(res.body.comentarios[0].id, target.id);
  assert.ok(res.body.proximoCursor);
  const next = response();
  await context({ user: author, params: { id: String(review.id), comentarioId: String(target.id) }, query: { apos: String(res.body.proximoCursor) } }, next);
  assert.equal(next.body.comentarios.length, 3);
  const bad = response(); await context({ user: author, params: { id: '9999', comentarioId: String(target.id) }, query: {} }, bad);
  assert.equal(bad.code, 404);
});

test('alvo removido fica indisponível e identidade antiga não abre ID reutilizado', async () => {
  const comment = await post(reader, 'Alvo que será removido');
  const event = (await comments.findById(comment.id)).evento_id;
  await comments.remove(comment.id, reader.id);
  const page = await list(author, { limit: '50' });
  assert.equal(page.body.notificacoes.find((n) => n.comentarioId === comment.id).alvoDisponivel, false);
  const gone = response();
  await context({ user: author, params: { id: String(review.id), comentarioId: String(comment.id) }, query: { eventoId: event } }, gone);
  assert.equal(gone.code, 410);
  const stale = response();
  await context({ user: author, params: { id: String(review.id), comentarioId: String(comment.id) }, query: { eventoId: '00000000-0000-0000-0000-000000000000' } }, stale);
  assert.equal(stale.code, 404);
});

test('reiniciar o processo preserva notificações e estado de leitura', async () => {
  await notifications.markRead(author.id);
  const { execFileSync } = require('node:child_process');
  const code = `const n = require('./src/repositories/notificacaoRepository'); n.unread(${author.id}).then(total => process.stdout.write(String(total)))`;
  const output = execFileSync(process.execPath, ['-e', code], { cwd: path.resolve(__dirname, '..'), env: process.env, encoding: 'utf8' });
  assert.equal(output, '0');
  assert.ok((await list(author)).body.notificacoes.length > 0);
});

test('rotas HTTP exigem sessão e mantêm leitura restrita ao destinatário', async (t) => {
  const express = require('express');
  const jwt = require('jsonwebtoken');
  const { once } = require('node:events');
  const app = express();
  app.use('/api/notificacoes', require('../src/routes/notificacoes'));
  app.use('/api/avaliacoes', require('../src/routes/avaliacoes'));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const token = jwt.sign({ id: third.id }, process.env.JWT_SECRET);
  assert.equal((await fetch(`${base}/api/notificacoes`)).status, 401);
  assert.equal((await fetch(`${base}/api/avaliacoes/1/comentarios/1/contexto`)).status, 401);
  const id = (await list(author)).body.notificacoes[0].id;
  assert.equal((await fetch(`${base}/api/notificacoes/${id}/lida`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } })).status, 404);
});

test('respostas profundas devolvem contexto anterior sem baixar a conversa inteira', async () => {
  let target = await post(reader, 'Raiz profunda');
  for (let i = 0; i < 53; i++) target = await post(reader, `Resposta profunda ${i}`, target.id);
  const res = response();
  await context({ user: author, params: { id: String(review.id), comentarioId: String(target.id) }, query: {} }, res);
  assert.equal(res.code, 200);
  assert.equal(res.body.ancestrais.length, 50);
  assert.ok(res.body.ancestralAnteriorId);
  assert.equal(res.body.comentarios.length, 1);
});

test('ID reutilizado após exclusão não abre o alvo de uma notificação antiga', async () => {
  const old = await comments.findById(1);
  await reviews.remove(review.id, author.id);
  review = await reviews.create({ userId: author.id, livro: { id: 'OL2W', titulo: 'Outro livro', autores: [] }, nota: 4, resenha: 'Outra leitura.' });
  const replacement = await post(reader, 'Outro comentário');
  assert.equal(replacement.id, old.id);
  const res = response();
  await context({ user: author, params: { id: String(review.id), comentarioId: String(old.id) }, query: { eventoId: old.evento_id } }, res);
  assert.equal(res.code, 404);
});
