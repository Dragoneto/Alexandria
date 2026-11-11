const pool = require('../config/database');

/**
 * Health check que passa pelo banco: GET /api/health.
 *
 * O GET / só diz que o servidor subiu. Esta rota roda um SELECT 1 no Postgres,
 * então serve para o keep-alive do GitHub Actions impedir que o Supabase pause
 * o projeto do plano grátis por falta de uso.
 */
function criarHealthCheck(banco) {
  return async (req, res) => {
    if (!banco) {
      return res.json({ status: 'ok', database: 'local' });
    }

    try {
      await banco.query('SELECT 1');
      return res.json({ status: 'ok', database: 'postgres' });
    } catch (error) {
      console.error(`❌ Health check sem acesso ao banco: ${error.message}`);
      return res.status(503).json({ status: 'erro', database: 'postgres' });
    }
  };
}

module.exports = { criarHealthCheck, healthCheck: criarHealthCheck(pool) };
