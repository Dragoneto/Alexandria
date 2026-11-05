// Cenários de docs/testes-persistencia.md no PostgreSQL, em um schema próprio de um banco de teste.
// Só usa TEST_DATABASE_URL: DATABASE_URL e DB_* são ignorados e apagados do ambiente deste processo.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { after, before, describe, test } = require('node:test');

const { criarAmbientePostgres } = require('./persistencia/ambiente');

const urlDeTeste = process.env.TEST_DATABASE_URL;

if (!urlDeTeste) {
  // No CI, um segredo faltando não pode virar um verde silencioso: EXIGIR_POSTGRES_DE_TESTE transforma o skip em falha
  if (process.env.EXIGIR_POSTGRES_DE_TESTE === 'true') {
    test('PostgreSQL de teste é obrigatório nesta execução', () => {
      assert.fail('EXIGIR_POSTGRES_DE_TESTE=true, mas TEST_DATABASE_URL não foi definida.');
    });
  } else {
    test('cenários de conversa no PostgreSQL', {
      skip: 'NÃO EXECUTADOS: defina TEST_DATABASE_URL ou rode npm run test:persistencia:pg',
    }, () => {});
  }
} else {
  const ambiente = criarAmbientePostgres(urlDeTeste);
  const { definirCenarios } = require('./persistencia/cenarios');
  const pool = require('../src/config/database');

  const TABELAS = ['users', 'avaliacoes', 'comentarios'];

  async function esquemaDasTabelas(cliente, schema) {
    const colunas = await cliente.query(
      `SELECT table_name, column_name, data_type, is_nullable,
              replace(column_default, $1, '') AS padrao
       FROM information_schema.columns
       WHERE table_schema = $2 AND table_name = ANY($3)
       ORDER BY table_name, column_name`,
      [`${schema}.`, schema, TABELAS],
    );
    const restricoes = await cliente.query(
      `SELECT c.conrelid::regclass::text AS tabela, c.contype, replace(pg_get_constraintdef(c.oid), $1, '') AS definicao
       FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
       WHERE n.nspname = $2
       ORDER BY 1, 2, 3`,
      [`${schema}.`, schema],
    );
    return {
      colunas: colunas.rows,
      restricoes: restricoes.rows.map((r) => ({ ...r, tabela: r.tabela.replace(`${schema}.`, '').replace(/"/g, '') })),
    };
  }

  definirCenarios(ambiente, (contexto) => {
    describe('integridade garantida pelo banco', () => {
      test('o banco recusa órfãos e comentário com texto e marcador em desacordo, mesmo sem passar pela API', async () => {
        const { ana, avaliacao, raiz } = await contexto().f.novaConversa();
        const inserir = (avaliacaoId, userId, paiId, texto = 'Direto no banco') =>
          pool.query('INSERT INTO comentarios (avaliacao_id, user_id, pai_id, texto) VALUES ($1, $2, $3, $4)', [
            avaliacaoId,
            userId,
            paiId,
            texto,
          ]);

        await assert.rejects(inserir(999999, ana.id, null), { code: '23503' });
        await assert.rejects(inserir(avaliacao.id, 999999, null), { code: '23503' });
        await assert.rejects(inserir(avaliacao.id, ana.id, 999999), { code: '23503' });
        await assert.rejects(inserir(avaliacao.id, ana.id, raiz.id, null), { code: '23514' });
      });

      test('apagar direto um usuário no banco não deixa órfãos', async () => {
        const { ana, bia, raiz, resposta } = await contexto().f.novaConversa();

        // A API ainda não exclui contas. Os cenários conferem as invariantes ao final deste teste
        await pool.query('DELETE FROM users WHERE id = $1', [bia.id]);

        const { comentarios, avaliacoes } = await ambiente.lerArmazenamento();
        assert.ok(!comentarios.some((c) => c.user_id === bia.id));
        // O cascade do pai_id leva as respostas das outras pessoas junto: é o que a tabela define hoje
        assert.ok(!comentarios.some((c) => c.id === raiz.id || c.id === resposta.id));
        assert.ok(avaliacoes.some((a) => a.user_id === ana.id));
      });

      test('init.sql e os initialize() dos repositórios criam as mesmas tabelas de conversa', async () => {
        const sql = fs.readFileSync(path.resolve(__dirname, '../src/database/init.sql'), 'utf8');
        const schemaDoSql = `${ambiente.schema}_init_sql`;

        await ambiente.comClienteAdministrativo(async (cliente) => {
          await cliente.query(`CREATE SCHEMA "${schemaDoSql}"`);
          try {
            await cliente.query(`SET search_path TO "${schemaDoSql}"`);
            await cliente.query(sql);
            await cliente.query('SET search_path TO DEFAULT');

            const viaRepositorios = await esquemaDasTabelas(cliente, ambiente.schema);
            const viaSql = await esquemaDasTabelas(cliente, schemaDoSql);
            const soAsConversas = ({ colunas, restricoes }) => ({
              colunas,
              restricoes: restricoes.filter((r) => TABELAS.includes(r.tabela)),
            });
            assert.deepEqual(soAsConversas(viaSql), soAsConversas(viaRepositorios));
            assert.ok(viaSql.colunas.length > 0 && soAsConversas(viaSql).restricoes.length > 0);
          } finally {
            await cliente.query(`DROP SCHEMA IF EXISTS "${schemaDoSql}" CASCADE`);
          }
        });
      });
    });

    describe('isolamento do PostgreSQL', () => {
      const vizinho = `${ambiente.schema}_vizinho`;

      before(async () => {
        await ambiente.comClienteAdministrativo(async (cliente) => {
          await cliente.query(`CREATE SCHEMA "${vizinho}"`);
          for (const tabela of TABELAS) {
            await cliente.query(`CREATE TABLE "${vizinho}".${tabela} (id INTEGER)`);
            await cliente.query(`INSERT INTO "${vizinho}".${tabela} VALUES (1)`);
          }
        });
      });

      after(async () => {
        await ambiente.comClienteAdministrativo((cliente) =>
          cliente.query(`DROP SCHEMA IF EXISTS "${vizinho}" CASCADE`),
        );
      });

      test('a limpeza não alcança tabelas de mesmo nome fora do schema da execução', async () => {
        await contexto().f.novaConversa();

        await ambiente.limpar();

        assert.deepEqual((await ambiente.lerArmazenamento()).comentarios, []);
        await ambiente.comClienteAdministrativo(async (cliente) => {
          for (const tabela of TABELAS) {
            const { rows } = await cliente.query(`SELECT COUNT(*)::int AS total FROM "${vizinho}".${tabela}`);
            assert.equal(rows[0].total, 1, `A limpeza alcançou ${vizinho}.${tabela}`);
          }
        });
      });

      test('os nomes de tabela que a aplicação usa resolvem para o schema da execução', async () => {
        for (const tabela of TABELAS) {
          const { rows } = await pool.query(
            `SELECT n.nspname AS schema FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE c.oid = to_regclass($1)`,
            [tabela],
          );
          assert.deepEqual(rows, [{ schema: ambiente.schema }]);
        }
      });
    });
  });
}
