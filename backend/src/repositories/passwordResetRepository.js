const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const pool = require('../config/database');

const localFile = process.env.LOCAL_RESETS_FILE
  ? path.resolve(process.env.LOCAL_RESETS_FILE)
  : path.resolve(__dirname, '../../.data/password-resets.json');
let pendingWrite = Promise.resolve();

function usePostgres() {
  return pool !== null;
}

// O token só existe inteiro no link que o usuário recebe. Aqui fica o hash:
// quem conseguir ler o armazenamento não consegue redefinir a senha de ninguém.
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function isValid(pedido, agora) {
  return !pedido.usado_em && new Date(pedido.expira_em).getTime() > agora;
}

async function readLocalResets() {
  try {
    const parsed = JSON.parse(await fs.readFile(localFile, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function writeLocalResets(pedidos) {
  await fs.mkdir(path.dirname(localFile), { recursive: true });
  const temporaryFile = `${localFile}.tmp`;
  await fs.writeFile(temporaryFile, JSON.stringify(pedidos, null, 2), 'utf8');
  await fs.rename(temporaryFile, localFile);
}

function serializeWrite(operation) {
  const next = pendingWrite.then(operation, operation);
  pendingWrite = next.catch(() => {});
  return next;
}

async function initialize() {
  if (usePostgres()) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash CHAR(64) UNIQUE NOT NULL,
        expira_em TIMESTAMPTZ NOT NULL,
        usado_em TIMESTAMPTZ,
        criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(
      'CREATE INDEX IF NOT EXISTS password_resets_user_id_idx ON password_resets (user_id)',
    );
    return;
  }

  await fs.mkdir(path.dirname(localFile), { recursive: true });
}

/** Guarda um pedido de redefinição e aproveita para limpar os que já venceram. */
async function create({ userId, token, expiraEm }) {
  const tokenHash = hashToken(token);

  if (usePostgres()) {
    await pool.query('DELETE FROM password_resets WHERE expira_em < NOW()');
    const result = await pool.query(
      'INSERT INTO password_resets (user_id, token_hash, expira_em) VALUES ($1, $2, $3) RETURNING id, user_id, expira_em',
      [userId, tokenHash, expiraEm],
    );
    return result.rows[0];
  }

  return serializeWrite(async () => {
    const pedidos = await readLocalResets();
    const agora = Date.now();
    const pedido = {
      id: pedidos.reduce((largest, candidate) => Math.max(largest, candidate.id), 0) + 1,
      user_id: Number(userId),
      token_hash: tokenHash,
      expira_em: new Date(expiraEm).toISOString(),
      usado_em: null,
      criado_em: new Date().toISOString(),
    };
    const vigentes = pedidos.filter((candidate) => new Date(candidate.expira_em).getTime() > agora);
    await writeLocalResets([...vigentes, pedido]);
    return { id: pedido.id, user_id: pedido.user_id, expira_em: pedido.expira_em };
  });
}

/** Devolve o pedido do token se ele ainda não venceu nem foi usado; null nos outros casos. */
async function findValidByToken(token) {
  const tokenHash = hashToken(token);

  if (usePostgres()) {
    const result = await pool.query(
      'SELECT id, user_id, expira_em, usado_em FROM password_resets WHERE token_hash = $1 AND usado_em IS NULL AND expira_em > NOW()',
      [tokenHash],
    );
    return result.rows[0] ?? null;
  }

  const pedidos = await readLocalResets();
  const agora = Date.now();
  const pedido = pedidos.find((candidate) => candidate.token_hash === tokenHash);

  return pedido && isValid(pedido, agora) ? pedido : null;
}

/** Marca como usados todos os pedidos abertos do usuário: um link atendido derruba os outros. */
async function invalidateForUser(userId) {
  if (usePostgres()) {
    const result = await pool.query(
      'UPDATE password_resets SET usado_em = NOW() WHERE user_id = $1 AND usado_em IS NULL',
      [userId],
    );
    return result.rowCount;
  }

  return serializeWrite(async () => {
    const pedidos = await readLocalResets();
    const usadoEm = new Date().toISOString();
    let atingidos = 0;

    const atualizados = pedidos.map((pedido) => {
      if (pedido.user_id !== Number(userId) || pedido.usado_em) return pedido;
      atingidos += 1;
      return { ...pedido, usado_em: usadoEm };
    });

    if (atingidos > 0) await writeLocalResets(atualizados);
    return atingidos;
  });
}

module.exports = {
  mode: usePostgres() ? 'postgres' : 'local-file',
  initialize,
  create,
  findValidByToken,
  invalidateForUser,
};
