// Os dois modos de armazenamento atrás da mesma interface, para os cenários não saberem em qual estão rodando.
//
// Crie o ambiente ANTES de carregar qualquer coisa de src/: os módulos leem process.env ao carregar.
// server.js nunca é carregado aqui, então o dotenv não traz o .env de quem está rodando o teste.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { validarBancoDeTeste } = require('./banco-de-teste');

const JWT_SECRET = 'segredo-dos-testes-de-persistencia';

function prepararVariaveis(especificas) {
  for (const nome of ['DATABASE_URL', 'DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'DB_SSL']) {
    delete process.env[nome];
  }
  Object.assign(process.env, { JWT_SECRET, ...especificas });
}

function repositorios() {
  return {
    users: require('../../src/repositories/userRepository'),
    avaliacoes: require('../../src/repositories/avaliacaoRepository'),
    comentarios: require('../../src/repositories/comentarioRepository'),
  };
}

// Na ordem das chaves estrangeiras, como no server.js
async function inicializarRepositorios() {
  const { users, avaliacoes, comentarios } = repositorios();
  await users.initialize();
  await avaliacoes.initialize();
  await comentarios.initialize();
}

// O mesmo formato nos dois modos: é lido direto do arquivo ou da tabela, sem passar pelos repositórios
function normalizarArmazenamento({ users, avaliacoes, comentarios }) {
  const porId = (a, b) => a.id - b.id;
  return {
    users: users.map(({ id, nome, email }) => ({ id, nome, email })).sort(porId),
    avaliacoes: avaliacoes.map(({ id, user_id, livro_id, nota }) => ({ id, user_id, livro_id, nota })).sort(porId),
    comentarios: comentarios
      .map(({ id, avaliacao_id, user_id, pai_id, texto, apagado_em }) => ({
        id,
        avaliacao_id,
        user_id,
        pai_id,
        texto,
        removido: apagado_em != null,
      }))
      .sort(porId),
  };
}

function criarAmbienteLocal() {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'alexandria-conversas-'));
  const arquivos = {
    users: path.join(pasta, 'users.json'),
    avaliacoes: path.join(pasta, 'avaliacoes.json'),
    comentarios: path.join(pasta, 'comentarios.json'),
  };
  prepararVariaveis({
    DB_MODE: 'local',
    LOCAL_DB_FILE: arquivos.users,
    LOCAL_REVIEWS_FILE: arquivos.avaliacoes,
    LOCAL_COMMENTS_FILE: arquivos.comentarios,
  });

  const lerLista = (arquivo) => {
    try {
      return JSON.parse(fs.readFileSync(arquivo, 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  };

  return {
    nome: 'JSON local',
    modo: 'local-file',
    pasta,
    inicializarRepositorios,

    async iniciar() {
      assert.equal(repositorios().users.mode, 'local-file', 'Os repositórios deveriam estar no JSON local');
      await inicializarRepositorios();
      return { pasta };
    },

    // A limpeza só alcança os três arquivos da pasta temporária criada acima
    async limpar() {
      for (const arquivo of Object.values(arquivos)) fs.rmSync(arquivo, { force: true });
    },

    async encerrar() {
      fs.rmSync(pasta, { recursive: true, force: true, maxRetries: 5 });
    },

    async lerArmazenamento() {
      return normalizarArmazenamento({
        users: lerLista(arquivos.users),
        avaliacoes: lerLista(arquivos.avaliacoes),
        comentarios: lerLista(arquivos.comentarios),
      });
    },

    async comentariosBrutos() {
      return fs.existsSync(arquivos.comentarios) ? fs.readFileSync(arquivos.comentarios, 'utf8') : '';
    },

    async definirCriacaoDaAvaliacao(id, criadoEm) {
      const lista = lerLista(arquivos.avaliacoes).map((a) => (a.id === id ? { ...a, criado_em: criadoEm } : a));
      fs.writeFileSync(arquivos.avaliacoes, JSON.stringify(lista, null, 2));
    },
  };
}

function criarAmbientePostgres(urlDeTeste) {
  const destino = validarBancoDeTeste(urlDeTeste);

  // Um schema por execução: nem a criação das tabelas nem a limpeza alcançam o que já existe no banco
  const schema = `conversas_teste_${process.pid}_${crypto.randomBytes(4).toString('hex')}`;
  const ssl = process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false;
  const urlDoSchema = new URL(urlDeTeste);
  urlDoSchema.searchParams.set('options', `-c search_path=${schema}`);

  prepararVariaveis({
    DB_MODE: 'postgres',
    DATABASE_URL: urlDoSchema.toString(),
    DB_SSL: ssl ? 'true' : 'false',
  });

  const pool = () => require('../../src/config/database');

  async function comClienteAdministrativo(operacao) {
    const { Client } = require('pg');
    const cliente = new Client({ connectionString: urlDeTeste, ssl });
    await cliente.connect();
    try {
      return await operacao(cliente);
    } finally {
      await cliente.end();
    }
  }

  return {
    nome: 'PostgreSQL',
    modo: 'postgres',
    schema,
    destino,
    comClienteAdministrativo,
    inicializarRepositorios,

    async iniciar() {
      assert.equal(repositorios().users.mode, 'postgres', 'Os repositórios deveriam estar no PostgreSQL');
      await comClienteAdministrativo((cliente) => cliente.query(`CREATE SCHEMA "${schema}"`));
      pool().removeAllListeners('connect'); // o aviso de conexão do config/database repetiria a cada conexão do pool

      // Se o search_path não valeu (um pooler que ignora options, por exemplo), as tabelas iriam para o public
      const { rows } = await pool().query(
        `SELECT current_schema() AS schema, current_database() AS banco, current_setting('server_version') AS versao,
                current_setting('server_encoding') AS codificacao`,
      );
      assert.equal(rows[0].schema, schema, 'A conexão da aplicação não está no schema de teste');

      await inicializarRepositorios();
      return rows[0];
    },

    // Nomes qualificados e sem CASCADE: o TRUNCATE só alcança as tabelas deste schema
    async limpar() {
      await pool().query(
        `TRUNCATE "${schema}".comentarios, "${schema}".avaliacoes, "${schema}".users RESTART IDENTITY`,
      );
    },

    async encerrar() {
      await pool().end();
      await comClienteAdministrativo(async (cliente) => {
        await cliente.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
        const { rows } = await cliente.query('SELECT 1 FROM information_schema.schemata WHERE schema_name = $1', [schema]);
        assert.equal(rows.length, 0, `O schema de teste ${schema} ficou no banco`);
      });
    },

    async lerArmazenamento() {
      const [users, avaliacoes, comentarios] = await Promise.all(
        ['users', 'avaliacoes', 'comentarios'].map(async (tabela) => {
          return (await pool().query(`SELECT * FROM "${schema}".${tabela}`)).rows;
        }),
      );
      return normalizarArmazenamento({ users, avaliacoes, comentarios });
    },

    async comentariosBrutos() {
      const { rows } = await pool().query(`SELECT row_to_json(c) AS linha FROM "${schema}".comentarios c`);
      return JSON.stringify(rows);
    },

    async definirCriacaoDaAvaliacao(id, criadoEm) {
      await pool().query(`UPDATE "${schema}".avaliacoes SET criado_em = $1 WHERE id = $2`, [criadoEm, id]);
    },
  };
}

module.exports = { criarAmbienteLocal, criarAmbientePostgres, JWT_SECRET };
