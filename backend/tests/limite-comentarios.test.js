// As variáveis precisam existir antes dos require: os módulos leem o ambiente ao carregar.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alexandria-limite-'));

process.env.DB_MODE = 'local';
process.env.LOCAL_DB_FILE = path.join(dataDir, 'users.json');
process.env.LOCAL_REVIEWS_FILE = path.join(dataDir, 'avaliacoes.json');
process.env.LOCAL_COMMENTS_FILE = path.join(dataDir, 'comentarios.json');
process.env.LOCAL_NOTIFICATIONS_FILE = path.join(dataDir, 'notificacoes.json');
process.env.JWT_SECRET = 'segredo-do-teste-de-limite';
process.env.COMENTARIOS_LIMITE = '3';
process.env.COMENTARIOS_JANELA_SEGUNDOS = '90';

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const express = require('express');
const jwt = require('jsonwebtoken');

const { criarLimite } = require('../src/middlewares/limiteDeComentarios');
const avaliacoes = require('../src/repositories/avaliacaoRepository');
const comentarios = require('../src/repositories/comentarioRepository');
const users = require('../src/repositories/userRepository');

let servidor;
let endereco;
let ana;
let bia;
let avaliacao;

before(async () => {
  await users.initialize();
  await avaliacoes.initialize();
  await comentarios.initialize();
  ana = await users.create({ nome: 'Ana', email: 'ana@limite.test', senhaHash: 'x' });
  bia = await users.create({ nome: 'Bia', email: 'bia@limite.test', senhaHash: 'x' });
  avaliacao = await avaliacoes.create({
    userId: ana.id,
    livro: { id: 'OL900W', titulo: 'Quincas Borba', autores: ['Machado de Assis'], capa: null },
    nota: 4,
    resenha: 'Leitura muito boa.',
  });

  // A rota de verdade, com login, limite e controller
  const app = express();
  app.use(express.json());
  app.use('/api/avaliacoes', require('../src/routes/avaliacoes'));
  servidor = await new Promise((resolve) => {
    const aberto = app.listen(0, '127.0.0.1', () => resolve(aberto));
  });
  endereco = `http://127.0.0.1:${servidor.address().port}/api/avaliacoes/${avaliacao.id}/comentarios`;
});

after(async () => {
  await new Promise((resolve) => servidor.close(resolve));
  fs.rmSync(dataDir, { recursive: true, force: true });
});

async function enviar(usuario, corpo, extras = {}) {
  const token = jwt.sign({ id: usuario.id, email: usuario.email }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const resposta = await fetch(endereco, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...extras },
    body: JSON.stringify(corpo),
  });
  return {
    status: resposta.status,
    retryAfter: resposta.headers.get('retry-after'),
    exposto: resposta.headers.get('access-control-expose-headers'),
    corpo: await resposta.json(),
  };
}

test('respostas em qualquer nível contam no mesmo limite, e quem passa dele recebe 429 com Retry-After', async () => {
  const raiz = (await enviar(ana, { texto: 'Raiz' })).corpo.comentario;
  const resposta = (await enviar(ana, { texto: 'Resposta', paiId: raiz.id })).corpo.comentario;
  const neta = await enviar(ana, { texto: 'Resposta da resposta', paiId: resposta.id });
  assert.equal(neta.status, 201);

  const quarta = await enviar(ana, { texto: 'Mais uma', paiId: neta.corpo.comentario.id });
  assert.equal(quarta.status, 429);
  assert.ok(Number(quarta.retryAfter) > 60 && Number(quarta.retryAfter) <= 90, quarta.retryAfter); // janela de 90 s
  assert.equal(quarta.exposto, 'Retry-After');
  assert.equal(quarta.corpo.error, `Você enviou muitos comentários em pouco tempo. Tente de novo em ${quarta.retryAfter} segundos.`);
  assert.equal((await comentarios.findByAvaliacao(avaliacao.id)).length, 3);

  // O limite é de cada conta: a outra segue normal
  assert.equal((await enviar(bia, { texto: 'Eu ainda posso' })).status, 201);
});

test('uma rajada simultânea da mesma conta não fura o limite', async () => {
  const cris = await users.create({ nome: 'Cris', email: 'cris@limite.test', senhaHash: 'x' });
  const respostas = await Promise.all(Array.from({ length: 6 }, (_, i) => enviar(cris, { texto: `Rajada ${i}` })));
  assert.deepEqual(respostas.map((r) => r.status).sort(), [201, 201, 201, 429, 429, 429]);
});

test('reenvios com a mesma Idempotency-Key também contam no limite', async () => {
  const davi = await users.create({ nome: 'Davi', email: 'davi@limite.test', senhaHash: 'x' });
  const status = [];
  for (let i = 0; i < 4; i += 1) {
    status.push((await enviar(davi, { texto: 'Mesmo envio' }, { 'Idempotency-Key': 'k'.repeat(16) })).status);
  }
  assert.deepEqual(status, [201, 201, 201, 429]);
});

/** Chama o middleware com uma resposta falsa: devolve 'passou' ou a resposta 429. */
function tentar(limitar, conta) {
  const res = {
    headers: {},
    set(nome, valor) {
      this.headers[nome] = valor;
      return this;
    },
    status(codigo) {
      this.statusCode = codigo;
      return this;
    },
    json(corpo) {
      this.body = corpo;
      return this;
    },
  };
  let passou = false;
  limitar({ user: { id: conta } }, res, () => (passou = true));
  return passou ? 'passou' : res;
}

test('a janela desliza: o Retry-After diz quanto falta, e a conta volta ao normal quando o envio mais antigo sai', (t) => {
  let relogio = 1_000_000;
  t.mock.method(performance, 'now', () => relogio);
  const limitar = criarLimite({ maximo: 3, janelaMs: 60_000 });

  assert.equal(tentar(limitar, 1), 'passou'); // 0 s
  relogio += 20_000;
  assert.equal(tentar(limitar, 1), 'passou'); // 20 s
  relogio += 20_000;
  assert.equal(tentar(limitar, 1), 'passou'); // 40 s
  relogio += 1_000;
  const barrado = tentar(limitar, 1); // 41 s: o de 0 s só sai da janela aos 60 s
  assert.deepEqual([barrado.statusCode, barrado.headers['Retry-After']], [429, '19']);

  relogio += 19_000; // 60 s: o de 0 s saiu
  assert.equal(tentar(limitar, 1), 'passou');
  const deNovo = tentar(limitar, 1); // os de 20 s, 40 s e 60 s ainda contam
  assert.deepEqual([deNovo.statusCode, deNovo.headers['Retry-After']], [429, '20']);

  relogio += 60_000; // passada a janela inteira, tudo volta ao normal
  assert.equal(tentar(limitar, 1), 'passou');
  assert.equal(tentar(limitar, 2), 'passou');
});

test('o Retry-After arredonda para cima, e com um segundo de espera a mensagem fala no singular', (t) => {
  let relogio = 1_000_000;
  t.mock.method(performance, 'now', () => relogio);
  const limitar = criarLimite({ maximo: 1, janelaMs: 1_000 });
  tentar(limitar, 1);
  relogio += 700; // faltam 0,3 s
  const barrado = tentar(limitar, 1);
  assert.equal(barrado.headers['Retry-After'], '1');
  assert.match(barrado.body.error, /Tente de novo em 1 segundo\.$/);
});

test('sem configuração, o padrão é 30 envios por minuto', (t) => {
  const caminho = require.resolve('../src/middlewares/limiteDeComentarios');
  const salvo = { COMENTARIOS_LIMITE: process.env.COMENTARIOS_LIMITE, COMENTARIOS_JANELA_SEGUNDOS: process.env.COMENTARIOS_JANELA_SEGUNDOS };
  delete process.env.COMENTARIOS_LIMITE;
  delete process.env.COMENTARIOS_JANELA_SEGUNDOS;
  delete require.cache[caminho];
  const padrao = require(caminho);
  Object.assign(process.env, salvo);

  let relogio = 1_000_000;
  t.mock.method(performance, 'now', () => relogio);
  for (let i = 0; i < 30; i += 1) assert.equal(tentar(padrao, 42), 'passou');
  const barrado = tentar(padrao, 42);
  assert.deepEqual([barrado.statusCode, barrado.headers['Retry-After']], [429, '60']);
});
