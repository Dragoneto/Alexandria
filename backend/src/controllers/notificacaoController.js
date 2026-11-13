const notificacoes = require('../repositories/notificacaoRepository');
const comentarios = require('../repositories/comentarioRepository');
const avaliacoes = require('../repositories/avaliacaoRepository');
const users = require('../repositories/userRepository');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function readCursor(value) {
  if (value === undefined) return null;
  if (typeof value !== 'string' || value.length > 300) throw new Error('Cursor inválido');
  const cursor = JSON.parse(Buffer.from(value, 'base64url').toString());
  if (!UUID.test(cursor?.id) || typeof cursor.data !== 'string' ||
      !Number.isFinite(Date.parse(cursor.data)) || new Date(cursor.data).toISOString() !== cursor.data) throw new Error('Cursor inválido');
  return cursor;
}

async function publicItem(row, names) {
  const comment = await comentarios.findById(row.comentario_id);
  const review = await avaliacoes.findById(row.avaliacao_id);
  const available = Boolean(review && comment && !comment.apagado_em &&
    comment.avaliacao_id === row.avaliacao_id && comment.evento_id === row.evento_id);
  return {
    id: row.id, tipo: row.tipo, autor: { id: row.ator_id, nome: names.get(row.ator_id) ?? 'Leitor' },
    avaliacaoId: row.avaliacao_id, comentarioId: row.comentario_id, eventoId: row.evento_id,
    livroTitulo: review?.livro_titulo ?? null,
    criadoEm: new Date(row.criado_em).toISOString(),
    lidaEm: row.lida_em ? new Date(row.lida_em).toISOString() : null, alvoDisponivel: available,
  };
}

async function list(req, res) {
  let cursor;
  const limit = req.query?.limit === undefined ? 20 : Number(req.query.limit);
  try {
    cursor = readCursor(req.query?.cursor);
    if ((req.query?.limit !== undefined && typeof req.query.limit !== 'string') ||
        !Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error();
  } catch {
    return res.status(400).json({ error: 'Paginação inválida' });
  }
  try {
    const rows = await notificacoes.list(req.user.id, cursor, limit);
    const page = rows.slice(0, limit);
    const names = new Map((await users.findNames([...new Set(page.map((r) => r.ator_id))])).map((u) => [u.id, u.nome]));
    const last = page.at(-1);
    const next = rows.length > limit ? Buffer.from(JSON.stringify({ data: new Date(last.criado_em).toISOString(), id: last.id })).toString('base64url') : null;
    return res.json({ notificacoes: await Promise.all(page.map((r) => publicItem(r, names))), proximoCursor: next });
  } catch (error) { return fail(res, error); }
}

function fail(res, error) {
  console.error('Erro nas notificações:', error.message);
  return res.status(500).json({ error: 'Não foi possível acessar as notificações' });
}

async function unread(req, res) {
  try { return res.json({ total: await notificacoes.unread(req.user.id) }); }
  catch (error) { return fail(res, error); }
}

async function markRead(req, res) {
  const id = req.params?.id ?? null;
  if (id !== null && !UUID.test(id)) return res.status(400).json({ error: 'Identificador inválido' });
  try {
    const count = await notificacoes.markRead(req.user.id, id);
    if (id && !count) return res.status(404).json({ error: 'Notificação não encontrada' });
    return res.json({ atualizadas: count });
  } catch (error) { return fail(res, error); }
}

module.exports = { list, unread, markRead };
