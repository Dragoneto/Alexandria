// Tracker de leitura no PostgreSQL: migração de uma tabela antiga e as mesmas regras do modo local.
// Só usa TEST_DATABASE_URL (rode com: node scripts/postgres-de-teste.js tests/biblioteca-tracker-postgres.test.js).
const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');

const { criarAmbientePostgres } = require('./persistencia/ambiente');

const urlDeTeste = process.env.TEST_DATABASE_URL;

if (!urlDeTeste) {
  test('tracker de leitura no PostgreSQL', {
    skip: 'NÃO EXECUTADOS: defina TEST_DATABASE_URL ou rode scripts/postgres-de-teste.js',
  }, () => {});
} else {
  const ambiente = criarAmbientePostgres(urlDeTeste);
  const pool = require('../src/config/database');
  const users = require('../src/repositories/userRepository');
  const biblioteca = require('../src/repositories/bibliotecaRepository');
  const openLibrary = require('../src/services/openLibrary');
  const { update, registrarDia } = require('../src/controllers/bibliotecaController');

  let userId;
  const getPageCountOriginal = openLibrary.getPageCount;

  async function chamar(handler, { body, params } = {}) {
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(value) {
        this.body = value;
        return this;
      },
    };
    await handler({ user: { id: userId }, body, params }, res);
    return res;
  }

  before(async () => {
    openLibrary.getPageCount = async () => 250;
    await ambiente.iniciar();
    // Tabela como está hoje em produção, antes do tracker: a inicialização tem de migrar sem perder dados
    await pool.query(`
      CREATE TABLE biblioteca (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        livro_id VARCHAR(20) NOT NULL,
        livro_titulo TEXT NOT NULL,
        livro_autores TEXT[] NOT NULL DEFAULT '{}',
        livro_capa TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'QUERO_LER',
        favorito BOOLEAN NOT NULL DEFAULT false,
        adicionado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, livro_id)
      )`);
    const usuario = await users.create({ nome: 'Ana', email: 'ana@teste.dev', senhaHash: 'x' });
    userId = usuario.id;
    await pool.query(
      `INSERT INTO biblioteca (user_id, livro_id, livro_titulo, status) VALUES ($1, 'OL20W', 'Antigo', 'QUERO_LER')`,
      [userId],
    );
    await biblioteca.initialize();
  });

  after(async () => {
    openLibrary.getPageCount = getPageCountOriginal;
    await ambiente.encerrar();
  });

  test('a migração mantém os itens antigos com progresso zerado', async () => {
    const [item] = await biblioteca.findByUser(userId);
    assert.equal(item.livro_titulo, 'Antigo');
    assert.equal(item.pagina_atual, 0);
    assert.equal(item.dias_leitura, 0);
    assert.equal(item.paginas_total, null);
  });

  test('"Lendo" busca páginas e conta o dia; abrir o app de novo no mesmo dia não soma', async () => {
    const [item] = await biblioteca.findByUser(userId);
    const res = await chamar(update, { params: { id: String(item.id) }, body: { status: 'LENDO' } });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.item.progresso.paginasTotal, 250);
    assert.equal(res.body.item.progresso.diasLeitura, 1);

    assert.equal((await chamar(registrarDia)).body.livrosAtualizados, 0);
    assert.equal(await biblioteca.registrarDiaDeLeitura(userId, '2099-01-01'), 1);
    assert.equal((await biblioteca.findById(item.id, userId)).dias_leitura, 2);
  });

  test('página atual, "Lido" e volta para "Lendo" gravam e limpam os campos certos', async () => {
    const [item] = await biblioteca.findByUser(userId);
    const params = { id: String(item.id) };
    assert.equal((await chamar(update, { params, body: { paginaAtual: 300 } })).statusCode, 400);
    assert.equal((await chamar(update, { params, body: { paginaAtual: 90 } })).body.item.progresso.paginaAtual, 90);

    const lido = await chamar(update, { params, body: { status: 'LIDO' } });
    assert.equal(lido.body.item.progresso.paginaAtual, 250);
    assert.ok(lido.body.item.progresso.concluidoEm);

    const voltou = await chamar(update, { params, body: { status: 'LENDO' } });
    assert.equal(voltou.body.item.progresso.concluidoEm, null);
  });

  test('dias de leitura do perfil contam cada dia uma vez só', async () => {
    assert.equal(await biblioteca.contarDiasDoUsuario(userId), 1);
    await biblioteca.registrarDiaDoUsuario(userId, '2099-01-01');
    await biblioteca.registrarDiaDoUsuario(userId, '2099-01-01');
    assert.equal((await chamar(registrarDia)).body.diasLeitura, 2);
  });
}
