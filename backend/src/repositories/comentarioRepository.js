const fs = require('node:fs/promises');
const path = require('node:path');

const pool = require('../config/database');

const localFile = process.env.LOCAL_COMMENTS_FILE
  ? path.resolve(process.env.LOCAL_COMMENTS_FILE)
  : path.resolve(__dirname, '../../.data/comentarios.json');
let pendingWrite = Promise.resolve();

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
  await fs.rename(temporaryFile, localFile);
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

/** Grava o comentário (paiId vazio: direto na avaliação). Devolve null se a avaliação sumiu antes de gravar. */
async function create({ avaliacaoId, userId, paiId, texto }) {
  if (usePostgres()) {
    try {
      const result = await pool.query(
        `INSERT INTO comentarios (avaliacao_id, user_id, pai_id, texto)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [avaliacaoId, userId, paiId ?? null, texto],
      );
      return result.rows[0];
    } catch (error) {
      if (error.code === '23503') return null;
      throw error;
    }
  }

  return serializeWrite(async () => {
    const comentarios = await readLocalComments();
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
    };
    await writeLocalComments([...comentarios, comentario]);
    return comentario;
  });
}

/** No arquivo não há chave estrangeira: quem apaga a avaliação chama isto para levar os comentários junto. */
async function removeByAvaliacao(avaliacaoId) {
  if (usePostgres()) return; // ON DELETE CASCADE

  await serializeWrite(async () => {
    const comentarios = await readLocalComments();
    const restantes = comentarios.filter((comentario) => comentario.avaliacao_id !== Number(avaliacaoId));
    if (restantes.length !== comentarios.length) await writeLocalComments(restantes);
  });
}

module.exports = { initialize, findById, findByAvaliacao, create, removeByAvaliacao };
