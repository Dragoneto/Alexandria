// Testa a API de verdade: sobe o server.js em outro processo e guarda tudo o que ele escreve no log.
//
// Por padrão a persistência é o JSON local. Com TEST_DATABASE_URL a mesma suíte roda no PostgreSQL;
// use um banco descartável, porque as contas de teste ficam nele.
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alexandria-senha-'));

// As variáveis precisam existir antes dos require: os módulos leem o ambiente ao carregar.
// NODE_ENV não é "test" porque, nesse modo, o Express não registra os erros e o teste de log não provaria nada
Object.assign(process.env, {
  NODE_ENV: 'development',
  JWT_SECRET: 'segredo-de-teste',
  RESET_CODE_DEBUG: 'true',
  SMTP_USER: '',
  SMTP_PASS: '',
  LOCAL_DB_FILE: path.join(dataDir, 'users.json'),
  LOCAL_RESETS_FILE: path.join(dataDir, 'password-resets.json'),
  LOCAL_REVIEWS_FILE: path.join(dataDir, 'avaliacoes.json'),
  LOCAL_COMMENTS_FILE: path.join(dataDir, 'comentarios.json'),
  LOCAL_LIBRARY_FILE: path.join(dataDir, 'biblioteca.json'),
  ...(process.env.TEST_DATABASE_URL
    ? {
        DB_MODE: 'postgres',
        DATABASE_URL: process.env.TEST_DATABASE_URL,
        DB_SSL: process.env.DB_SSL ?? 'false',
      }
    : { DB_MODE: 'local' }),
});

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { setTimeout: esperar } = require('node:timers/promises');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const pool = require('../src/config/database');
const { changePassword } = require('../src/controllers/authController');
const avaliacoes = require('../src/repositories/avaliacaoRepository');
const biblioteca = require('../src/repositories/bibliotecaRepository');
const users = require('../src/repositories/userRepository');

const SENHA_ANTIGA = 'senhaAntiga1';
const SENHA_NOVA = 'senhaNova123';
const FOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgK';
const LIVRO = { id: 'OL1W', titulo: 'O Nome da Rosa', autores: ['Umberto Eco'], capa: null };
// O erro do JSON.parse corta o que cita do corpo, então procurar a senha inteira não acharia o vazamento
const TRECHO_MALFORMADO = 'senhaMal';

// Tudo o que não pode sair em log nem nas respostas da troca de senha
const segredos = new Set([SENHA_ANTIGA, SENHA_NOVA]);
const respostasDaTroca = [];

let servidor;
let encerrado;
let baseUrl;
let log = '';

function portaLivre() {
  return new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.on('error', reject);
    socket.listen(0, '127.0.0.1', () => {
      const { port } = socket.address();
      socket.close(() => resolve(port));
    });
  });
}

async function subirServidor() {
  const porta = await portaLivre();
  baseUrl = `http://127.0.0.1:${porta}`;

  // cwd fora do backend: assim o dotenv não acha o .env de quem está rodando o teste
  servidor = spawn(process.execPath, [path.resolve(__dirname, '../src/server.js')], {
    cwd: dataDir,
    env: { ...process.env, PORT: String(porta) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  servidor.stdout.on('data', (trecho) => (log += trecho));
  servidor.stderr.on('data', (trecho) => (log += trecho));
  encerrado = new Promise((resolve) => servidor.once('close', resolve));

  for (let tentativa = 0; tentativa < 200; tentativa += 1) {
    if (servidor.exitCode !== null) break;
    try {
      await fetch(baseUrl);
      return;
    } catch {
      await esperar(50);
    }
  }
  assert.fail(`A API não subiu:\n${log}`);
}

async function derrubarServidor() {
  if (servidor.exitCode === null) servidor.kill();
  await encerrado;
}

async function api(metodo, caminho, { token, autorizacao, corpo, bruto } = {}) {
  const resposta = await fetch(`${baseUrl}${caminho}`, {
    method: metodo,
    headers: {
      ...(corpo !== undefined || bruto !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(autorizacao ? { Authorization: autorizacao } : {}),
    },
    body: bruto ?? (corpo === undefined ? undefined : JSON.stringify(corpo)),
  });
  const texto = await resposta.text();
  return { status: resposta.status, corpo: JSON.parse(texto), texto };
}

async function alterarSenha(token, corpo) {
  const resposta = await api('PUT', '/api/auth/password', { token, corpo });
  respostasDaTroca.push(resposta.texto);
  return resposta;
}

function entrar(email, senha) {
  return api('POST', '/api/auth/login', { corpo: { email, senha } });
}

async function novaConta(senha = SENHA_ANTIGA) {
  const email = `leitora-${crypto.randomUUID()}@alexandria.test`;
  const { status, corpo } = await api('POST', '/api/auth/register', {
    corpo: { nome: 'Leitora', email, senha },
  });
  assert.equal(status, 201);
  segredos.add(corpo.token);
  return { id: corpo.user.id, email, senha, token: corpo.token };
}

async function hashDe(email) {
  return (await users.findByEmail(email)).senha_hash;
}

/** Resposta falsa do Express, para os casos que só dá para provocar dentro do processo. */
function fakeResponse() {
  return {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

before(subirServidor);

after(async () => {
  await derrubarServidor();
  await pool?.end();
  fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 5 });
});

test('senha atual certa: a nova entra, a antiga não, e a resposta só traz a mensagem', async () => {
  const conta = await novaConta();

  const { status, corpo } = await alterarSenha(conta.token, {
    senhaAtual: SENHA_ANTIGA,
    novaSenha: SENHA_NOVA,
  });

  assert.equal(status, 200);
  assert.deepEqual(corpo, { message: 'Senha alterada com sucesso!' });

  assert.equal((await entrar(conta.email, SENHA_NOVA)).status, 200);
  assert.equal((await entrar(conta.email, SENHA_ANTIGA)).status, 401);
});

test('senha atual incorreta responde 400, nunca 401, e não troca nada', async () => {
  const conta = await novaConta();
  const hashAntes = await hashDe(conta.email);

  const { status, corpo } = await alterarSenha(conta.token, {
    senhaAtual: 'senhaErrada99',
    novaSenha: SENHA_NOVA,
  });

  // No app, 401 apaga a sessão do aparelho: errar a senha não pode deslogar
  assert.equal(status, 400);
  assert.equal(corpo.error, 'A senha atual está incorreta');
  assert.deepEqual(corpo.errors, { senhaAtual: 'A senha atual está incorreta' });
  assert.equal(await hashDe(conta.email), hashAntes);
  assert.equal((await api('GET', '/api/auth/profile', { token: conta.token })).status, 200);
});

test('sem sessão válida responde 401 e não troca nada', async () => {
  const conta = await novaConta();
  const hashAntes = await hashDe(conta.email);
  const corpo = { senhaAtual: SENHA_ANTIGA, novaSenha: SENHA_NOVA };
  const dadosDoToken = { id: conta.id, email: conta.email };

  const tentativas = [
    {},
    { autorizacao: 'Bearer' },
    { token: 'token-que-nao-e-jwt' },
    { token: jwt.sign(dadosDoToken, process.env.JWT_SECRET, { expiresIn: -10 }) },
    { token: jwt.sign(dadosDoToken, 'segredo-de-outro-servidor') },
  ];

  for (const tentativa of tentativas) {
    const resposta = await api('PUT', '/api/auth/password', { ...tentativa, corpo });
    assert.equal(resposta.status, 401, JSON.stringify(tentativa));
  }

  assert.equal(await hashDe(conta.email), hashAntes);
});

test('token válido de conta inexistente responde 401; conta apagada no meio da troca responde 404', async (t) => {
  const corpo = { senhaAtual: SENHA_ANTIGA, novaSenha: SENHA_NOVA };
  const token = jwt.sign({ id: 999999 }, process.env.JWT_SECRET);

  const resposta = await api('PUT', '/api/auth/password', { token, corpo });
  assert.equal(resposta.status, 401);
  assert.match(resposta.corpo.error, /Sessão inválida/);

  // Conta apagada depois de o middleware conferir a sessão
  const semConta = fakeResponse();
  await changePassword({ body: corpo, user: { id: 999999 } }, semConta);
  assert.equal(semConta.statusCode, 404);

  // Conta apagada entre conferir a senha e gravar a nova
  const conta = await novaConta();
  t.mock.method(users, 'updatePassword', async () => null);
  const semGravar = fakeResponse();
  await changePassword({ body: corpo, user: { id: conta.id } }, semGravar);
  assert.equal(semGravar.statusCode, 404);
});

test('campos ausentes ou de tipo inválido são recusados campo a campo', async () => {
  const conta = await novaConta();
  const hashAntes = await hashDe(conta.email);
  const ambos = ['novaSenha', 'senhaAtual'];

  const casos = [
    [{}, ambos],
    [[], ambos],
    [{ novaSenha: SENHA_NOVA }, ['senhaAtual']],
    [{ senhaAtual: SENHA_ANTIGA }, ['novaSenha']],
    [{ senhaAtual: '', novaSenha: '' }, ambos],
    [{ senhaAtual: null, novaSenha: null }, ambos],
    [{ senhaAtual: 123456789, novaSenha: SENHA_NOVA }, ['senhaAtual']],
    [{ senhaAtual: true, novaSenha: SENHA_NOVA }, ['senhaAtual']],
    [{ senhaAtual: SENHA_ANTIGA, novaSenha: 12345678 }, ['novaSenha']],
    [{ senhaAtual: [SENHA_ANTIGA], novaSenha: { valor: SENHA_NOVA } }, ambos],
  ];

  for (const [corpo, campos] of casos) {
    const resposta = await alterarSenha(conta.token, corpo);
    assert.equal(resposta.status, 400, JSON.stringify(corpo));
    assert.equal(typeof resposta.corpo.error, 'string');
    assert.deepEqual(Object.keys(resposta.corpo.errors).sort(), campos, JSON.stringify(corpo));
  }

  assert.equal(await hashDe(conta.email), hashAntes);
});

test('nova senha fora da política do cadastro é recusada', async () => {
  const conta = await novaConta();
  const hashAntes = await hashDe(conta.email);

  for (const novaSenha of ['curta12', 'somenteletras', '123456789']) {
    const { status, corpo } = await alterarSenha(conta.token, {
      senhaAtual: SENHA_ANTIGA,
      novaSenha,
    });
    assert.equal(status, 400);
    assert.match(corpo.errors.novaSenha, /pelo menos 8 caracteres, com letra e número/);
  }

  assert.equal(await hashDe(conta.email), hashAntes);
});

test('id ou e-mail de outra conta no corpo não mudam a conta alterada', async () => {
  const conta = await novaConta();
  const outra = await novaConta();
  const hashDaOutra = await hashDe(outra.email);

  const { status } = await alterarSenha(conta.token, {
    senhaAtual: SENHA_ANTIGA,
    novaSenha: SENHA_NOVA,
    id: outra.id,
    userId: outra.id,
    user_id: outra.id,
    email: outra.email,
  });

  assert.equal(status, 200);
  assert.equal(await hashDe(outra.email), hashDaOutra);
  assert.equal(await bcrypt.compare(SENHA_NOVA, await hashDe(conta.email)), true);
});

test('token com e-mail velho altera a conta da sessão, não a que assumiu aquele e-mail', async () => {
  const conta = await novaConta();
  const emailNovo = `novo-${crypto.randomUUID()}@alexandria.test`;

  const edicao = await api('PUT', '/api/auth/profile', {
    token: conta.token,
    corpo: { nome: 'Leitora', email: emailNovo },
  });
  assert.equal(edicao.status, 200);

  // Outra pessoa se cadastra com o e-mail que ainda está dentro do token da primeira
  const senhaDaOutra = 'senhaDaOutra1';
  segredos.add(senhaDaOutra);
  const cadastro = await api('POST', '/api/auth/register', {
    corpo: { nome: 'Outra', email: conta.email, senha: senhaDaOutra },
  });
  assert.equal(cadastro.status, 201);
  segredos.add(cadastro.corpo.token);
  const hashDaOutra = await hashDe(conta.email);

  const comSenhaDaOutra = await alterarSenha(conta.token, {
    senhaAtual: senhaDaOutra,
    novaSenha: SENHA_NOVA,
  });
  assert.equal(comSenhaDaOutra.status, 400);

  const comSenhaDaConta = await alterarSenha(conta.token, {
    senhaAtual: SENHA_ANTIGA,
    novaSenha: SENHA_NOVA,
  });
  assert.equal(comSenhaDaConta.status, 200);
  assert.equal(await hashDe(conta.email), hashDaOutra);
  assert.equal(await bcrypt.compare(SENHA_NOVA, await hashDe(emailNovo)), true);
});

test('só o hash muda: perfil, foto, biblioteca e avaliações continuam iguais', async () => {
  const conta = await novaConta();
  const foto = await api('PUT', '/api/auth/profile/photo', { token: conta.token, corpo: { foto: FOTO } });
  assert.equal(foto.status, 200);
  await biblioteca.create({ userId: conta.id, livro: LIVRO, status: 'LENDO' });
  await avaliacoes.create({ userId: conta.id, livro: LIVRO, nota: 4, resenha: 'Uma leitura muito boa.' });

  async function retrato() {
    const { senha_hash: senhaHash, ...dados } = await users.findByEmail(conta.email);
    return {
      senhaHash,
      dados,
      perfil: (await api('GET', '/api/auth/profile', { token: conta.token })).corpo,
      biblioteca: await biblioteca.findByUser(conta.id),
      avaliacoes: await avaliacoes.findByUser(conta.id),
    };
  }

  const { senhaHash: hashAntes, ...antes } = await retrato();
  assert.equal(antes.dados.foto, FOTO);
  assert.equal(antes.biblioteca.length, 1);
  assert.equal(antes.avaliacoes.length, 1);

  const { status } = await alterarSenha(conta.token, {
    senhaAtual: SENHA_ANTIGA,
    novaSenha: SENHA_NOVA,
  });
  assert.equal(status, 200);

  const { senhaHash: hashDepois, ...depois } = await retrato();
  assert.deepEqual(depois, antes);
  assert.notEqual(hashDepois, hashAntes);
  assert.match(hashDepois, /^\$2[aby]\$10\$/);
  assert.ok(!hashDepois.includes(SENHA_NOVA));
});

test('editar o perfil não troca a senha, seja qual for o campo enviado', async () => {
  const conta = await novaConta();
  const hashAntes = await hashDe(conta.email);
  const senhaSemVerificar = 'senhaSemVerificar1';
  segredos.add(senhaSemVerificar);

  const { status, texto } = await api('PUT', '/api/auth/profile', {
    token: conta.token,
    corpo: {
      nome: 'Leitora',
      email: conta.email,
      senha: senhaSemVerificar,
      novaSenha: senhaSemVerificar,
      password: senhaSemVerificar,
      senhaHash: senhaSemVerificar,
      senha_hash: senhaSemVerificar,
    },
  });

  assert.equal(status, 200);
  assert.ok(!texto.includes('senha'), 'o perfil não pode devolver campo de senha');
  assert.equal(await hashDe(conta.email), hashAntes);
  assert.equal((await entrar(conta.email, SENHA_ANTIGA)).status, 200);
  assert.equal((await entrar(conta.email, senhaSemVerificar)).status, 401);
});

test('sessões já emitidas continuam valendo depois da troca, como está documentado', async () => {
  const conta = await novaConta();
  const outroAparelho = await entrar(conta.email, SENHA_ANTIGA);
  segredos.add(outroAparelho.corpo.token);

  const { status } = await alterarSenha(conta.token, {
    senhaAtual: SENHA_ANTIGA,
    novaSenha: SENHA_NOVA,
  });
  assert.equal(status, 200);

  // Se um dia o backend passar a revogar, este teste e o README precisam mudar juntos
  for (const token of [conta.token, outroAparelho.corpo.token]) {
    assert.equal((await api('GET', '/api/auth/profile', { token })).status, 200);
  }
});

test('recuperação por código continua funcionando depois de uma troca', async () => {
  const conta = await novaConta();
  await alterarSenha(conta.token, { senhaAtual: SENHA_ANTIGA, novaSenha: SENHA_NOVA });

  const senhaRecuperada = 'senhaRecuperada1';
  segredos.add(senhaRecuperada);
  const pedido = await api('POST', '/api/auth/forgot-password', { corpo: { email: conta.email } });
  assert.equal(pedido.status, 200);

  const redefinicao = await api('POST', '/api/auth/reset-password', {
    corpo: { email: conta.email, codigo: pedido.corpo.resetCode, senha: senhaRecuperada },
  });
  assert.equal(redefinicao.status, 200);

  assert.equal((await entrar(conta.email, senhaRecuperada)).status, 200);
  assert.equal((await entrar(conta.email, SENHA_NOVA)).status, 401);
});

test('JSON malformado responde 400 em JSON, sem devolver o trecho da senha', async () => {
  const conta = await novaConta();
  const senhaMalformada = `${TRECHO_MALFORMADO}formada1`;
  segredos.add(senhaMalformada);

  const pedidos = [
    ['PUT', '/api/auth/password', conta.token, `{"senhaAtual": ${senhaMalformada}}`],
    ['POST', '/api/auth/login', undefined, `{"email":"a@b.c","senha": ${senhaMalformada}}`],
  ];

  for (const [metodo, caminho, token, bruto] of pedidos) {
    const { status, corpo, texto } = await api(metodo, caminho, { token, bruto });
    assert.equal(status, 400);
    assert.deepEqual(corpo, { error: 'O corpo da requisição não é um JSON válido' });
    assert.ok(!texto.includes(TRECHO_MALFORMADO));
  }
});

test('falha ao gravar responde 500 genérico e o log só leva a mensagem do erro', async (t) => {
  const conta = await novaConta();
  t.mock.method(users, 'updatePassword', async () => {
    throw new Error('banco fora do ar');
  });
  const erro = t.mock.method(console, 'error', () => {});

  const res = fakeResponse();
  await changePassword(
    { body: { senhaAtual: SENHA_ANTIGA, novaSenha: SENHA_NOVA }, user: { id: conta.id } },
    res,
  );

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { error: 'Erro interno do servidor' });
  assert.deepEqual(erro.mock.calls[0].arguments, ['Erro ao alterar senha:', 'banco fora do ar']);
});

// Fica por último: confere o log de tudo o que os testes acima fizeram
test('nenhuma senha, token ou hash aparece no log nem nas respostas da troca', async () => {
  await esperar(100);
  await derrubarServidor();

  assert.match(log, /Alexandria API rodando/, 'o log do servidor precisa ter sido capturado');
  assert.ok(segredos.size > 3);
  assert.ok(respostasDaTroca.length > 10);

  for (const segredo of segredos) {
    assert.ok(!log.includes(segredo), 'um segredo apareceu no log');
    for (const resposta of respostasDaTroca) {
      assert.ok(!resposta.includes(segredo), `um segredo apareceu na resposta: ${resposta}`);
    }
  }

  assert.ok(!log.includes(TRECHO_MALFORMADO), 'o trecho do JSON malformado apareceu no log');
  assert.ok(!/\$2[aby]\$/.test(log), 'um hash apareceu no log');
  assert.ok(respostasDaTroca.every((resposta) => !/\$2[aby]\$|senha_hash/.test(resposta)));
});
