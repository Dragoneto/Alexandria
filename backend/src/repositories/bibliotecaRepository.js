const fs = require('node:fs/promises');
const path = require('node:path');

const pool = require('../config/database');

const localFile = process.env.LOCAL_LIBRARY_FILE
  ? path.resolve(process.env.LOCAL_LIBRARY_FILE)
  : path.resolve(__dirname, '../../.data/biblioteca.json');
let pendingWrite = Promise.resolve();

function usePostgres() {
  return pool !== null;
}

async function readLocalItems() {
  try {
    const parsed = JSON.parse(await fs.readFile(localFile, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function writeLocalItems(itens) {
  await fs.mkdir(path.dirname(localFile), { recursive: true });
  const temporaryFile = `${localFile}.tmp`;
  await fs.writeFile(temporaryFile, JSON.stringify(itens, null, 2), 'utf8');
  await fs.rename(temporaryFile, localFile);
}

function serializeWrite(operation) {
  const next = pendingWrite.then(operation, operation);
  pendingWrite = next.catch(() => {});
  return next;
}

function duplicateError() {
  const error = new Error('Livro já está na biblioteca');
  error.code = 'DUPLICATE_LIBRARY_ITEM';
  return error;
}

async function initialize() {
  if (usePostgres()) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS biblioteca (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        livro_id VARCHAR(20) NOT NULL,
        livro_titulo TEXT NOT NULL,
        livro_autores TEXT[] NOT NULL DEFAULT '{}',
        livro_capa TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'QUERO_LER'
          CHECK (status IN ('QUERO_LER', 'LENDO', 'LIDO', 'ABANDONADO')),
        favorito BOOLEAN NOT NULL DEFAULT false,
        adicionado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, livro_id)
      )
    `);
    return;
  }

  await fs.mkdir(path.dirname(localFile), { recursive: true });
}

async function findByUser(userId, status) {
  if (usePostgres()) {
    const whereStatus = status ? ' AND status = $2' : '';
    const result = await pool.query(
      `SELECT * FROM biblioteca WHERE user_id = $1${whereStatus} ORDER BY adicionado_em DESC`,
      status ? [userId, status] : [userId],
    );
    return result.rows;
  }

  return (await readLocalItems())
    .filter(
      (item) => item.user_id === Number(userId) && (!status || item.status === status),
    )
    .sort((a, b) => b.adicionado_em.localeCompare(a.adicionado_em));
}

async function create({ userId, livro, status }) {
  if (usePostgres()) {
    try {
      const result = await pool.query(
        `INSERT INTO biblioteca (user_id, livro_id, livro_titulo, livro_autores, livro_capa, status)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [userId, livro.id, livro.titulo, livro.autores, livro.capa, status],
      );
      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') throw duplicateError();
      throw error;
    }
  }

  return serializeWrite(async () => {
    const itens = await readLocalItems();
    if (itens.some((i) => i.user_id === Number(userId) && i.livro_id === livro.id)) {
      throw duplicateError();
    }
    const item = {
      id: itens.reduce((largest, candidate) => Math.max(largest, candidate.id), 0) + 1,
      user_id: Number(userId),
      livro_id: livro.id,
      livro_titulo: livro.titulo,
      livro_autores: livro.autores,
      livro_capa: livro.capa,
      status,
      favorito: false,
      adicionado_em: new Date().toISOString(),
    };
    await writeLocalItems([...itens, item]);
    return item;
  });
}

async function update(id, userId, { status, favorito }) {
  if (usePostgres()) {
    const result = await pool.query(
      `UPDATE biblioteca
       SET status = COALESCE($3, status), favorito = COALESCE($4, favorito)
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId, status ?? null, favorito ?? null],
    );
    return result.rows[0] ?? null;
  }

  return serializeWrite(async () => {
    const itens = await readLocalItems();
    const index = itens.findIndex(
      (item) => item.id === Number(id) && item.user_id === Number(userId),
    );
    if (index < 0) return null;

    const atualizado = { ...itens[index] };
    if (status !== undefined) atualizado.status = status;
    if (favorito !== undefined) atualizado.favorito = favorito;
    itens[index] = atualizado;
    await writeLocalItems(itens);
    return atualizado;
  });
}

async function remove(id, userId) {
  if (usePostgres()) {
    const result = await pool.query('DELETE FROM biblioteca WHERE id = $1 AND user_id = $2', [
      id,
      userId,
    ]);
    return result.rowCount > 0;
  }

  return serializeWrite(async () => {
    const itens = await readLocalItems();
    const restantes = itens.filter((i) => !(i.id === Number(id) && i.user_id === Number(userId)));
    if (restantes.length === itens.length) return false;
    await writeLocalItems(restantes);
    return true;
  });
}


module.exports = { initialize, findByUser, create, update, remove };
