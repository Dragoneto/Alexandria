const { Pool } = require('pg');

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
const hasIndividualConfig = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'].every(
  (name) => Boolean(process.env[name]),
);
const shouldUsePostgres =
  process.env.DB_MODE === 'postgres' ||
  (process.env.DB_MODE !== 'local' && (hasDatabaseUrl || hasIndividualConfig));

const pool = shouldUsePostgres
  ? hasDatabaseUrl
    ? new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
      })
    : new Pool({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      })
  : null;

// Teste de conexão ao iniciar
pool?.on('connect', () => {
  console.log('✅ Conectado ao PostgreSQL');
});

pool?.on('error', (err) => {
  console.error('❌ Erro na conexão com PostgreSQL:', err.message);
});

module.exports = pool;
