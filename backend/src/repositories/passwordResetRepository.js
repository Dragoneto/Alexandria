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

// O código só existe inteiro no e-mail que o usuário recebe. Aqui fica só o hash.
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
        token_hash CHAR(64) NOT NULL,
        expira_em TIMESTAMPTZ NOT NULL,
        usado_em TIMESTAMPTZ,
        tentativas INTEGER NOT NULL DEFAULT 0,
        criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(
      'CREATE INDEX IF NOT EXISTS password_resets_user_id_idx ON password_resets (user_id)',
    );
    // Bancos criados na época do link: ganham o contador e perdem o UNIQUE,
    // porque dois pedidos podem sortear o mesmo código de 6 dígitos
    await pool.query(
      'ALTER TABLE password_resets ADD COLUMN IF NOT EXISTS tentativas INTEGER NOT NULL DEFAULT 0',
    );
    await pool.query(
      'ALTER TABLE password_resets DROP CONSTRAINT IF EXISTS password_resets_token_hash_key',
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
      tentativas: 0,
      criado_em: new Date().toISOString(),
    };
    const vigentes = pedidos.filter((candidate) => new Date(candidate.expira_em).getTime() > agora);
    await writeLocalResets([...vigentes, pedido]);
    return { id: pedido.id, user_id: pedido.user_id, expira_em: pedido.expira_em };
  });
}

/** Devolve o pedido mais recente do usuário que ainda não venceu nem foi usado; null se não houver. */
async function findOpenByUser(userId) {
  if (usePostgres()) {
    const result = await pool.query(
      'SELECT id, user_id, token_hash FROM password_resets WHERE user_id = $1 AND usado_em IS NULL AND expira_em > NOW() ORDER BY id DESC LIMIT 1',
      [userId],
    );
    return result.rows[0] ?? null;
  }

  const pedidos = await readLocalResets();
  const agora = Date.now();
  const abertos = pedidos.filter(
    (pedido) => pedido.user_id === Number(userId) && isValid(pedido, agora),
  );

  return abertos.at(-1) ?? null;
}

/** Confere o código digitado sem deixar o tempo da comparação dar pistas. */
function matches(pedido, codigo) {
  return crypto.timingSafeEqual(
    Buffer.from(hashToken(codigo), 'hex'),
    Buffer.from(pedido.token_hash, 'hex'),
  );
}

/**
 * Gasta uma tentativa do pedido; devolve false se ele já foi usado ou esgotou o limite.
 * A tentativa conta antes da comparação, para chutes simultâneos não passarem do limite.
 */
async function claimAttempt(id, limite) {
  if (usePostgres()) {
    const result = await pool.query(
      'UPDATE password_resets SET tentativas = tentativas + 1 WHERE id = $1 AND usado_em IS NULL AND tentativas < $2',
      [id, limite],
    );
    return result.rowCount > 0;
  }

  return serializeWrite(async () => {
    const pedidos = await readLocalResets();
    const index = pedidos.findIndex((pedido) => pedido.id === Number(id));
    const pedido = pedidos[index];
    const tentativas = pedido?.tentativas ?? 0;
    if (!pedido || pedido.usado_em || tentativas >= limite) return false;
    const atualizados = [...pedidos];
    atualizados[index] = { ...pedido, tentativas: tentativas + 1 };
    await writeLocalResets(atualizados);
    return true;
  });
}

/** Marca como usados todos os pedidos abertos do usuário: código novo ou usado derruba os anteriores. */
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
  findOpenByUser,
  matches,
  claimAttempt,
  invalidateForUser,
};
