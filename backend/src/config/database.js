const { Pool } = require('pg');

// Pool gerencia múltiplas conexões automaticamente
// Isso evita abrir/fechar conexão a cada requisição
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Teste de conexão ao iniciar
pool.on('connect', () => {
  console.log('✅ Conectado ao PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ Erro na conexão com PostgreSQL:', err.message);
});

module.exports = pool;
