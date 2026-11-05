const assert = require('node:assert/strict');
const { before, after, test } = require('node:test');
const { criarAmbientePostgres } = require('./persistencia/ambiente');

if (!process.env.TEST_DATABASE_URL) {
  test('notificações em PostgreSQL real', { skip: 'Defina TEST_DATABASE_URL ou use scripts/postgres-de-teste.js' }, () => {});
} else {
  const env = criarAmbientePostgres(process.env.TEST_DATABASE_URL);
  const pool = require('../src/config/database');
  const users = require('../src/repositories/userRepository');
  const reviews = require('../src/repositories/avaliacaoRepository');
  const comments = require('../src/repositories/comentarioRepository');
  const notifications = require('../src/repositories/notificacaoRepository');
  let review, author, reader;
  before(async () => {
    await env.iniciar();
    author = await users.create({ nome: 'Autor', email: 'author@example.test', senhaHash: 'test' });
    reader = await users.create({ nome: 'Leitor', email: 'reader@example.test', senhaHash: 'test' });
    review = await reviews.create({ userId: author.id, livro: { id: 'OL1W', titulo: 'Livro', autores: [] }, nota: 4, resenha: 'Boa leitura.' });
  });
  after(() => env.encerrar());
  const input = (key) => ({ avaliacaoId: review.id, userId: reader.id, texto: 'Comentário', idempotencyKey: key, payloadHash: key, destinatarios: [{ id: author.id, tipo: 'comentario' }] });

  test('transação e reenvio concorrente persistem apenas uma notificação', async () => {
    const [a, b] = await Promise.all([comments.create(input('postgres-notification-001')), comments.create(input('postgres-notification-001'))]);
    assert.equal(a.id, b.id);
    assert.equal(await notifications.unread(author.id), 1);
    assert.equal((await notifications.list(reader.id, null, 20)).length, 0);
    const rows = await notifications.list(author.id, null, 20);
    assert.equal(rows[0].evento_id, a.evento_id);
    assert.equal(await notifications.markRead(reader.id, rows[0].id), 0);
    assert.equal(await notifications.markRead(author.id, rows[0].id), 1);
    assert.equal(await notifications.markRead(author.id, rows[0].id), 1);
    assert.equal(await notifications.unread(author.id), 0);
  });

  test('falha na notificação desfaz também o comentário', async () => {
    const invalid = input('postgres-notification-failure');
    invalid.destinatarios[0].tipo = 'tipo-invalido';
    await assert.rejects(comments.create(invalid), { code: '23514' });
    assert.equal(await comments.findByIdempotencyKey(reader.id, invalid.idempotencyKey), null);
    assert.equal((await pool.query('SELECT COUNT(*)::int AS total FROM notificacoes')).rows[0].total, 1);
  });

  test('páginas e contexto consultam apenas a avaliação pedida', async () => {
    const root = await comments.create(input('context-root'));
    const reply = await comments.create({ ...input('context-reply'), paiId: root.id });
    const page = await notifications.list(author.id, null, 1);
    const cursor = { data: page[0].criado_em.toISOString(), id: page[0].id };
    const next = await notifications.list(author.id, cursor, 1);
    assert.ok(next.every((n) => n.id !== page[0].id));
    const { context } = require('../src/controllers/comentarioContextoController');
    const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await context({ user: author, params: { id: String(review.id), comentarioId: String(reply.id) }, query: { eventoId: reply.evento_id } }, res);
    assert.equal(res.code, 200);
    assert.deepEqual(res.body.ancestrais.map((c) => c.id), [root.id]);
    assert.equal(res.body.alvo.id, reply.id);
  });

  test('remover avaliação preserva aviso com alvo indisponível', async () => {
    await reviews.remove(review.id, author.id);
    const rows = await notifications.list(author.id, null, 20);
    assert.equal(rows.length, 3);
    assert.equal(await comments.findById(rows[0].comentario_id), null);
  });
}
