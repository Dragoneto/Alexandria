const fs = require('node:fs/promises');
const path = require('node:path');

const pool = require('../config/database');

const localFile = process.env.LOCAL_REVIEWS_FILE
  ? path.resolve(process.env.LOCAL_REVIEWS_FILE)
  : path.resolve(__dirname, '../../.data/avaliacoes.json');
let pendingWrite = Promise.resolve();

function usePostgres() {
  return pool !== null;
}

async function readLocalReviews() {
  try {
    const parsed = JSON.parse(await fs.readFile(localFile, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function writeLocalReviews(avaliacoes) {
  await fs.mkdir(path.dirname(localFile), { recursive: true });
  const temporaryFile = `${localFile}.tmp`;
  await fs.writeFile(temporaryFile, JSON.stringify(avaliacoes, null, 2), 'utf8');
  await fs.rename(temporaryFile, localFile);
}

function serializeWrite(operation) {
  const next = pendingWrite.then(operation, operation);
  pendingWrite = next.catch(() => {});
  return next;
}

// Mais recentes primeiro pela data de criação (editar não muda a posição); o id desempata
function maisRecentesPrimeiro(a, b) {
  return b.criado_em.localeCompare(a.criado_em) || b.id - a.id;
}

function duplicateError() {
  const error = new Error('Avaliação já existe para este livro');
  error.code = 'DUPLICATE_REVIEW';
  return error;
}

async function initialize() {
  if (usePostgres()) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS avaliacoes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        livro_id VARCHAR(20) NOT NULL,
        livro_titulo TEXT NOT NULL,
        livro_autores TEXT[] NOT NULL DEFAULT '{}',
        livro_capa TEXT,
        nota SMALLINT NOT NULL CHECK (nota BETWEEN 1 AND 5),
        resenha TEXT,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, livro_id)
      )
    `);
    await pool.query('CREATE INDEX IF NOT EXISTS avaliacoes_livro_id_idx ON avaliacoes (livro_id)');
    return;
  }

  await fs.mkdir(path.dirname(localFile), { recursive: true });
}

async function findById(id) {
  if (usePostgres()) {
    const result = await pool.query('SELECT * FROM avaliacoes WHERE id = $1', [id]);
    return result.rows[0] ?? null;
  }

  return (await readLocalReviews()).find((avaliacao) => avaliacao.id === Number(id)) ?? null;
}

async function findByUserAndBook(userId, livroId) {
  if (usePostgres()) {
    const result = await pool.query(
      'SELECT * FROM avaliacoes WHERE user_id = $1 AND livro_id = $2',
      [userId, livroId],
    );
    return result.rows[0] ?? null;
  }

  return (
    (await readLocalReviews()).find(
      (avaliacao) => avaliacao.user_id === Number(userId) && avaliacao.livro_id === livroId,
    ) ?? null
  );
}

/** Uma página das avaliações do livro, com a de usuarioId primeiro, e o total e a soma das notas do livro inteiro. */
async function findByBook(livroId, { usuarioId, limit, offset }) {
  if (usePostgres()) {
    const resumo = await pool.query(
      'SELECT COUNT(*)::int AS total, COALESCE(SUM(nota), 0)::int AS soma FROM avaliacoes WHERE livro_id = $1',
      [livroId],
    );
    const pagina = await pool.query(
      `SELECT * FROM avaliacoes WHERE livro_id = $1
       ORDER BY (user_id = $2) DESC, criado_em DESC, id DESC LIMIT $3 OFFSET $4`,
      [livroId, usuarioId, limit, offset],
    );
    return { avaliacoes: pagina.rows, ...resumo.rows[0] };
  }

  const doLivro = (await readLocalReviews()).filter((a) => a.livro_id === livroId);
  const minha = (a) => (a.user_id === Number(usuarioId) ? 1 : 0);
  doLivro.sort((a, b) => minha(b) - minha(a) || maisRecentesPrimeiro(a, b));
  const soma = doLivro.reduce((total, a) => total + a.nota, 0);
  return { avaliacoes: doLivro.slice(offset, offset + limit), total: doLivro.length, soma };
}

async function findByUser(userId) {
  if (usePostgres()) {
    const result = await pool.query(
      'SELECT * FROM avaliacoes WHERE user_id = $1 ORDER BY criado_em DESC, id DESC',
      [userId],
    );
    return result.rows;
  }

  return (await readLocalReviews())
    .filter((avaliacao) => avaliacao.user_id === Number(userId))
    .sort(maisRecentesPrimeiro);
}

async function create({ userId, livro, nota, resenha }) {
  if (usePostgres()) {
    try {
      const result = await pool.query(
        `INSERT INTO avaliacoes (user_id, livro_id, livro_titulo, livro_autores, livro_capa, nota, resenha)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [userId, livro.id, livro.titulo, livro.autores, livro.capa, nota, resenha],
      );
      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') throw duplicateError();
      throw error;
    }
  }

  return serializeWrite(async () => {
    const avaliacoes = await readLocalReviews();
    if (avaliacoes.some((a) => a.user_id === Number(userId) && a.livro_id === livro.id)) {
      throw duplicateError();
    }
    const agora = new Date().toISOString();
    const avaliacao = {
      id: avaliacoes.reduce((largest, candidate) => Math.max(largest, candidate.id), 0) + 1,
      user_id: Number(userId),
      livro_id: livro.id,
      livro_titulo: livro.titulo,
      livro_autores: livro.autores,
      livro_capa: livro.capa,
      nota,
      resenha,
      criado_em: agora,
      atualizado_em: agora,
    };
    await writeLocalReviews([...avaliacoes, avaliacao]);
    return avaliacao;
  });
}

async function update(id, userId, { nota, resenha }) {
  if (usePostgres()) {
    const result = await pool.query(
      `UPDATE avaliacoes SET nota = $1, resenha = $2, atualizado_em = NOW()
       WHERE id = $3 AND user_id = $4 RETURNING *`,
      [nota, resenha, id, userId],
    );
    return result.rows[0] ?? null;
  }

  return serializeWrite(async () => {
    const avaliacoes = await readLocalReviews();
    const index = avaliacoes.findIndex((a) => a.id === Number(id) && a.user_id === Number(userId));
    if (index === -1) return null;
    const avaliacao = { ...avaliacoes[index], nota, resenha, atualizado_em: new Date().toISOString() };
    const atualizadas = [...avaliacoes];
    atualizadas[index] = avaliacao;
    await writeLocalReviews(atualizadas);
    return avaliacao;
  });
}

async function remove(id, userId) {
  if (usePostgres()) {
    const result = await pool.query('DELETE FROM avaliacoes WHERE id = $1 AND user_id = $2', [
      id,
      userId,
    ]);
    return result.rowCount > 0;
  }

  return serializeWrite(async () => {
    const avaliacoes = await readLocalReviews();
    const restantes = avaliacoes.filter(
      (a) => !(a.id === Number(id) && a.user_id === Number(userId)),
    );
    if (restantes.length === avaliacoes.length) return false;
    await writeLocalReviews(restantes);
    return true;
  });
}

module.exports = { initialize, findById, findByUserAndBook, findByBook, findByUser, create, update, remove };
