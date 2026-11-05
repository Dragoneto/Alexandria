const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const notificacoes = require('./notificacaoRepository');

const pool = require('../config/database');
const { substituirArquivo } = require('./arquivoLocal');

const localFile = process.env.LOCAL_COMMENTS_FILE
  ? path.resolve(process.env.LOCAL_COMMENTS_FILE)
  : path.resolve(__dirname, '../../.data/comentarios.json');
let pendingWrite = Promise.resolve();
const RETENCAO_DA_KEY_MS = 24 * 60 * 60 * 1000;

function usePostgres() {
  return pool !== null;
}

async function readLocalComments() {
  try {
    const parsed = JSON.parse(await fs.readFile(localFile, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function writeLocalComments(comentarios) {
  await fs.mkdir(path.dirname(localFile), { recursive: true });
  const temporaryFile = `${localFile}.tmp`;
  await fs.writeFile(temporaryFile, JSON.stringify(comentarios, null, 2), 'utf8');
  await substituirArquivo(temporaryFile, localFile);
}

function serializeWrite(operation) {
  const next = pendingWrite.then(operation, operation);
  pendingWrite = next.catch(() => {});
  return next;
}

async function initialize() {
  if (usePostgres()) {
    // Apagar só marca o comentário (apagado_em) e tira o texto: as respostas de outras pessoas continuam
    await pool.query(`
      CREATE TABLE IF NOT EXISTS comentarios (
        id SERIAL PRIMARY KEY,
        avaliacao_id INTEGER NOT NULL REFERENCES avaliacoes(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        pai_id INTEGER REFERENCES comentarios(id) ON DELETE CASCADE,
        texto TEXT,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        apagado_em TIMESTAMPTZ,
        CHECK ((texto IS NULL) = (apagado_em IS NOT NULL))
      )
    `);
    await pool.query(
      'CREATE INDEX IF NOT EXISTS comentarios_avaliacao_id_idx ON comentarios (avaliacao_id)',
    );
    // Idempotency key do envio: vale por usuário, e o envio sem key fica com NULL, que não conflita
    await pool.query(`
      ALTER TABLE comentarios
        ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
        ADD COLUMN IF NOT EXISTS payload_hash TEXT
    `);
    await pool.query('ALTER TABLE comentarios ADD COLUMN IF NOT EXISTS evento_id UUID');
    await notificacoes.initialize();
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS comentarios_idempotency_key_idx
      ON comentarios (user_id, idempotency_key)
    `);
    // Versão do comentário: a edição confere a versão para não sobrescrever uma alteração mais nova
    await pool.query('ALTER TABLE comentarios ADD COLUMN IF NOT EXISTS versao INTEGER NOT NULL DEFAULT 1');
    return;
  }

  await fs.mkdir(path.dirname(localFile), { recursive: true });
}

async function findById(id) {
  if (usePostgres()) {
    const result = await pool.query('SELECT * FROM comentarios WHERE id = $1', [id]);
    return result.rows[0] ?? null;
  }

  return (await readLocalComments()).find((comentario) => comentario.id === Number(id)) ?? null;
}

/** Todos os comentários da avaliação, apagados inclusive, em ordem de criação: o pai vem antes das respostas. */
async function findByAvaliacao(avaliacaoId) {
  if (usePostgres()) {
    const result = await pool.query(
      'SELECT * FROM comentarios WHERE avaliacao_id = $1 ORDER BY id',
      [avaliacaoId],
    );
    return result.rows;
  }

  return (await readLocalComments())
    .filter((comentario) => comentario.avaliacao_id === Number(avaliacaoId))
    .sort((a, b) => a.id - b.id);
}

/** O comentário que este usuário já gravou com essa idempotency key. */
async function findByIdempotencyKey(userId, idempotencyKey) {
  if (usePostgres()) {
    const result = await pool.query(
      'SELECT * FROM comentarios WHERE user_id = $1 AND idempotency_key = $2',
      [userId, idempotencyKey],
    );
    return result.rows[0] ?? null;
  }

  return (
    (await readLocalComments()).find(
      (c) => c.user_id === Number(userId) && c.idempotency_key === idempotencyKey,
    ) ?? null
  );
}

/**
 * Grava o comentário (paiId vazio: direto na avaliação). Devolve null se a avaliação sumiu antes de gravar.
 * Com uma idempotency key que este usuário já usou, não grava outro: devolve o comentário que tem a key.
 */
async function create({ avaliacaoId, userId, paiId, texto, idempotencyKey = null, payloadHash = null, destinatarios = [] }) {
  const eventoId = crypto.randomUUID();
  if (usePostgres()) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // No conflito, o UPDATE não muda nada: só faz o RETURNING devolver a linha que já tem a key.
      // O unique index faz a requisição simultânea esperar a primeira terminar
      const result = await client.query(
        `INSERT INTO comentarios (avaliacao_id, user_id, pai_id, texto, idempotency_key, payload_hash, evento_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (user_id, idempotency_key) DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
         RETURNING *`,
        [avaliacaoId, userId, paiId ?? null, texto, idempotencyKey, payloadHash, eventoId],
      );
      if (result.rows[0].evento_id === eventoId) {
        await notificacoes.deliver(notificacoes.eventFor(result.rows[0], destinatarios), client);
      }
      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      if (error.code === '23503') return null;
      throw error;
    } finally {
      client.release();
    }
  }

  return serializeWrite(async () => {
    const comentarios = await readLocalComments();
    // Mesmo papel do unique index do Postgres: a key vale por usuário
    const existente =
      idempotencyKey &&
      comentarios.find((c) => c.user_id === Number(userId) && c.idempotency_key === idempotencyKey);
    if (existente) return existente;
    const agora = new Date().toISOString();
    const comentario = {
      id: comentarios.reduce((maior, candidato) => Math.max(maior, candidato.id), 0) + 1,
      avaliacao_id: Number(avaliacaoId),
      user_id: Number(userId),
      pai_id: paiId == null ? null : Number(paiId),
      texto,
      criado_em: agora,
      atualizado_em: agora,
      apagado_em: null,
      idempotency_key: idempotencyKey,
      payload_hash: payloadHash,
      evento_id: eventoId,
    };
    comentario.notification_events = notificacoes.eventFor(comentario, destinatarios);
    await writeLocalComments([...comentarios, comentario]);
    return comentario;
  });
}

async function update(id, userId, texto) {
  if (usePostgres()) {
    const result = await pool.query(
      `UPDATE comentarios SET texto = $1, atualizado_em = NOW()
       WHERE id = $2 AND user_id = $3 AND apagado_em IS NULL RETURNING *`,
      [texto, id, userId],
    );
    return result.rows[0] ?? null;
  }

  return alterarLocal(id, userId, { texto, atualizado_em: new Date().toISOString() });
}

/** Soft delete: tira o texto e marca o comentário; as respostas de outras pessoas continuam. */
async function remove(id, userId) {
  if (usePostgres()) {
    const result = await pool.query(
      `UPDATE comentarios SET texto = NULL, apagado_em = NOW()
       WHERE id = $1 AND user_id = $2 AND apagado_em IS NULL RETURNING *`,
      [id, userId],
    );
    return result.rows[0] ?? null;
  }

  return alterarLocal(id, userId, { texto: null, apagado_em: new Date().toISOString() });
}

// Mesmo filtro do WHERE do Postgres: só comentário vivo e do próprio autor
function alterarLocal(id, userId, mudancas) {
  return serializeWrite(async () => {
    const lista = await readLocalComments();
    const index = lista.findIndex(
      (c) => c.id === Number(id) && c.user_id === Number(userId) && !c.apagado_em,
    );
    if (index === -1) return null;
    const alterado = { ...lista[index], ...mudancas };
    const atualizados = [...lista];
    atualizados[index] = alterado;
    await writeLocalComments(atualizados);
    return alterado;
  });
}

/** No arquivo não há chave estrangeira: quem apaga a avaliação chama isto para levar os comentários junto. */
async function removeByAvaliacao(avaliacaoId) {
  if (usePostgres()) return; // ON DELETE CASCADE

  await serializeWrite(async () => {
    const comentarios = await readLocalComments();
    const restantes = comentarios.filter((comentario) => comentario.avaliacao_id !== Number(avaliacaoId));
    await notificacoes.deliver(comentarios.filter((c) => c.avaliacao_id === Number(avaliacaoId)).flatMap((c) => c.notification_events ?? []));
    if (restantes.length !== comentarios.length) await writeLocalComments(restantes);
  });
}

/** Retention: a idempotency key vale por 24 horas. Depois disso ela é esquecida (vira NULL), e o comentário continua. */
async function expireIdempotencyKeys() {
  const limite = new Date(Date.now() - RETENCAO_DA_KEY_MS);
  if (usePostgres()) {
    // shortcut: varre a tabela a cada envio com key; se pesar, um índice parcial em criado_em resolve
    await pool.query(
      `UPDATE comentarios SET idempotency_key = NULL, payload_hash = NULL
       WHERE idempotency_key IS NOT NULL AND criado_em < $1`,
      [limite],
    );
    return;
  }

  await serializeWrite(async () => {
    const comentarios = await readLocalComments();
    const vencida = (c) => c.idempotency_key && new Date(c.criado_em) < limite;
    if (!comentarios.some(vencida)) return;
    await writeLocalComments(
      comentarios.map((c) => (vencida(c) ? { ...c, idempotency_key: null, payload_hash: null } : c)),
    );
  });
}

async function findContextPage(avaliacaoId, afterId, limit) {
  if (pool) return (await pool.query(
    'SELECT * FROM comentarios WHERE avaliacao_id = $1 AND id > $2 ORDER BY id LIMIT $3',
    [avaliacaoId, afterId, limit],
  )).rows;
  return (await readLocalComments()).filter((c) => c.avaliacao_id === Number(avaliacaoId) && c.id > afterId)
    .sort((a, b) => a.id - b.id).slice(0, limit);
}

module.exports = {
  findContextPage,
  notificationEvents: async () => (await readLocalComments()).flatMap((c) => c.notification_events ?? []),
  initialize,
  findById,
  findByAvaliacao,
  findByIdempotencyKey,
  create,
  update,
  remove,
  removeByAvaliacao,
  expireIdempotencyKeys,
};
