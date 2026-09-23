const fs = require('node:fs/promises');
const path = require('node:path');

const pool = require('../config/database');

const localFile = process.env.LOCAL_DB_FILE
  ? path.resolve(process.env.LOCAL_DB_FILE)
  : path.resolve(__dirname, '../../.data/users.json');
let pendingWrite = Promise.resolve();

function usePostgres() {
  return pool !== null;
}

async function readLocalUsers() {
  try {
    const parsed = JSON.parse(await fs.readFile(localFile, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function writeLocalUsers(users) {
  await fs.mkdir(path.dirname(localFile), { recursive: true });
  const temporaryFile = `${localFile}.tmp`;
  await fs.writeFile(temporaryFile, JSON.stringify(users, null, 2), 'utf8');
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
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        senha_hash VARCHAR(255) NOT NULL,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    return;
  }

  await fs.mkdir(path.dirname(localFile), { recursive: true });
}

async function findByEmail(email) {
  if (usePostgres()) {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0] ?? null;
  }

  const users = await readLocalUsers();
  return users.find((user) => user.email === email) ?? null;
}

async function findById(id) {
  if (usePostgres()) {
    const result = await pool.query(
      'SELECT id, nome, email, criado_em FROM users WHERE id = $1',
      [id],
    );
    return result.rows[0] ?? null;
  }

  const users = await readLocalUsers();
  const user = users.find((candidate) => candidate.id === Number(id));
  if (!user) return null;
  const { senha_hash: _password, ...profile } = user;
  return profile;
}

async function create({ nome, email, senhaHash }) {
  if (usePostgres()) {
    const result = await pool.query(
      'INSERT INTO users (nome, email, senha_hash) VALUES ($1, $2, $3) RETURNING id, nome, email, criado_em',
      [nome, email, senhaHash],
    );
    return result.rows[0];
  }

  return serializeWrite(async () => {
    const users = await readLocalUsers();
    if (users.some((user) => user.email === email)) {
      const error = new Error('Email já cadastrado');
      error.code = 'DUPLICATE_EMAIL';
      throw error;
    }
    const user = {
      id: users.reduce((largest, candidate) => Math.max(largest, candidate.id), 0) + 1,
      nome,
      email,
      senha_hash: senhaHash,
      criado_em: new Date().toISOString(),
    };
    await writeLocalUsers([...users, user]);
    const { senha_hash: _password, ...profile } = user;
    return profile;
  });
}

module.exports = {
  mode: usePostgres() ? 'postgres' : 'local-file',
  initialize,
  findByEmail,
  findById,
  create,
};
