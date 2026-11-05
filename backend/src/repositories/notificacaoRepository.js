const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const pool = require('../config/database');
const { substituirArquivo } = require('./arquivoLocal');

const localFile = process.env.LOCAL_NOTIFICATIONS_FILE || path.join(
  process.env.LOCAL_COMMENTS_FILE ? path.dirname(process.env.LOCAL_COMMENTS_FILE) : path.resolve(__dirname, '../../.data'),
  'notificacoes.json',
);
let pending = Promise.resolve();

async function read() {
  try {
    const data = JSON.parse(await fs.readFile(localFile, 'utf8'));
    if (!Array.isArray(data)) throw new Error('Armazenamento de notificações inválido');
    return data;
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

function change(operation) {
  const next = pending.then(async () => {
    const rows = await read();
    const result = operation(rows);
    await fs.mkdir(path.dirname(localFile), { recursive: true });
    await fs.writeFile(`${localFile}.tmp`, JSON.stringify(rows), 'utf8');
    await substituirArquivo(`${localFile}.tmp`, localFile);
    return result;
  });
  pending = next.catch(() => {});
  return next;
}

async function initialize() {
  if (!pool) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS notificacoes (
    id UUID PRIMARY KEY, evento_id UUID NOT NULL, destinatario_id INTEGER NOT NULL,
    ator_id INTEGER NOT NULL, avaliacao_id INTEGER NOT NULL, comentario_id INTEGER NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('comentario', 'resposta')),
    criado_em TIMESTAMPTZ NOT NULL, lida_em TIMESTAMPTZ,
    UNIQUE (evento_id, destinatario_id)
  )`);
  await pool.query('CREATE INDEX IF NOT EXISTS notificacoes_destinatario_idx ON notificacoes (destinatario_id, criado_em DESC, id DESC)');
}

function eventFor(comment, recipients) {
  const recipientsById = new Map(recipients.map((r) => [Number(r.id), r.tipo]));
  recipientsById.delete(Number(comment.user_id));
  return [...recipientsById].map(([id, tipo]) => ({
    id: crypto.randomUUID(), evento_id: comment.evento_id, destinatario_id: id,
    ator_id: comment.user_id, avaliacao_id: comment.avaliacao_id, comentario_id: comment.id,
    tipo, criado_em: comment.criado_em, lida_em: null,
  }));
}

// PostgreSQL usa a mesma transação do comentário. O JSON recebe eventos duráveis do próprio comentário.
async function deliver(events, client = pool) {
  if (!events?.length) return;
  if (client) {
    for (const e of events) await client.query(`INSERT INTO notificacoes
      (id, evento_id, destinatario_id, ator_id, avaliacao_id, comentario_id, tipo, criado_em)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (evento_id, destinatario_id) DO NOTHING`,
    [e.id, e.evento_id, e.destinatario_id, e.ator_id, e.avaliacao_id, e.comentario_id, e.tipo, e.criado_em]);
    return;
  }
  await change((rows) => {
    for (const e of events) if (!rows.some((r) => r.evento_id === e.evento_id && r.destinatario_id === e.destinatario_id)) rows.push(e);
  });
}

async function recover() {
  if (!pool) await deliver(await require('./comentarioRepository').notificationEvents());
}

async function list(userId, cursor, limit) {
  await recover();
  if (pool) {
    const { rows } = await pool.query(`SELECT * FROM notificacoes WHERE destinatario_id = $1
      ${cursor ? 'AND (criado_em, id) < ($3::timestamptz, $4::uuid)' : ''}
      ORDER BY criado_em DESC, id DESC LIMIT $2`, cursor ? [userId, limit + 1, cursor.data, cursor.id] : [userId, limit + 1]);
    return rows;
  }
  return (await read()).filter((r) => r.destinatario_id === Number(userId))
    .sort((a, b) => b.criado_em.localeCompare(a.criado_em) || b.id.localeCompare(a.id))
    .filter((r) => !cursor || r.criado_em < cursor.data || (r.criado_em === cursor.data && r.id < cursor.id))
    .slice(0, limit + 1);
}

async function unread(userId) {
  await recover();
  if (pool) return (await pool.query('SELECT COUNT(*)::int AS total FROM notificacoes WHERE destinatario_id = $1 AND lida_em IS NULL', [userId])).rows[0].total;
  return (await read()).filter((r) => r.destinatario_id === Number(userId) && !r.lida_em).length;
}

async function markRead(userId, id = null) {
  await recover();
  if (pool) {
    const result = await pool.query(`UPDATE notificacoes SET lida_em = COALESCE(lida_em, NOW())
      WHERE destinatario_id = $1 ${id ? 'AND id = $2' : 'AND lida_em IS NULL'} RETURNING id`, id ? [userId, id] : [userId]);
    return result.rowCount;
  }
  return change((rows) => {
    let count = 0;
    for (const r of rows) if (r.destinatario_id === Number(userId) && (id ? r.id === id : !r.lida_em)) {
      r.lida_em ??= new Date().toISOString();
      count += 1;
    }
    return count;
  });
}

module.exports = { initialize, eventFor, deliver, recover, list, unread, markRead };
