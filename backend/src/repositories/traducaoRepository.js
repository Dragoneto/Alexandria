const pool = require('../config/database');

// Cache permanente das traduções do DeepL. Cada texto é traduzido uma vez só:
// a memória do servidor se perde quando o Render dorme, a tabela não.
// Sem PostgreSQL (modo local) o cache fica só na memória do bookTranslation.

async function initialize() {
  if (!pool) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS traducoes (
    chave TEXT PRIMARY KEY,
    traducao TEXT NOT NULL,
    idioma_origem TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
}

/** Devolve um Map chave -> { text, lang } com as traduções já salvas. */
async function buscar(chaves) {
  if (!pool || !chaves.length) return new Map();
  const { rows } = await pool.query(
    'SELECT chave, traducao, idioma_origem FROM traducoes WHERE chave = ANY($1::text[])',
    [chaves],
  );
  return new Map(rows.map((row) => [row.chave, { text: row.traducao, lang: row.idioma_origem }]));
}

/** Salva traduções novas; se outra requisição salvou a mesma antes, mantém a primeira. */
async function salvar(entradas) {
  if (!pool || !entradas.length) return;
  const valores = [];
  const linhas = entradas.map(({ chave, text, lang }, index) => {
    valores.push(chave, text, lang ?? null);
    return `($${index * 3 + 1}, $${index * 3 + 2}, $${index * 3 + 3})`;
  });
  await pool.query(
    `INSERT INTO traducoes (chave, traducao, idioma_origem) VALUES ${linhas.join(', ')}
     ON CONFLICT (chave) DO NOTHING`,
    valores,
  );
}

module.exports = { initialize, buscar, salvar };
