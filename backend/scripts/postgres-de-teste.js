// Roda os testes de persistência em um PostgreSQL descartável: um cluster novo em pasta temporária, em porta
// livre, só em 127.0.0.1 e apagado no fim. Não usa o serviço instalado, nem senha, nem o .env; só os executáveis.
//
//   npm run test:persistencia:pg                    a suíte de persistência
//   node scripts/postgres-de-teste.js <arquivos>    outros arquivos de teste no mesmo banco descartável
//
// Se os executáveis não estiverem no PATH nem nas pastas comuns, indique a pasta deles em PG_BIN.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

const USUARIO = 'alexandria_teste';
const BANCO = 'alexandria_test';
const SUITE = [
  'tests/arquivo-local.test.js',
  'tests/banco-de-teste.test.js',
  'tests/conversas-local.test.js',
  'tests/conversas-postgres.test.js',
];
const EXTENSAO = process.platform === 'win32' ? '.exe' : '';

function subpastasDeVersao(raiz, sufixo = 'bin') {
  if (!fs.existsSync(raiz)) return [];
  return fs
    .readdirSync(raiz)
    .sort((a, b) => parseFloat(b) - parseFloat(a)) // a versão mais nova primeiro
    .map((versao) => path.join(raiz, versao, sufixo));
}

function acharExecutaveis() {
  const pastas = [
    process.env.PG_BIN,
    ...(process.env.PATH ?? '').split(path.delimiter),
    ...subpastasDeVersao('C:\\Program Files\\PostgreSQL'),
    ...subpastasDeVersao('/usr/lib/postgresql'),
  ].filter(Boolean);
  const pasta = pastas.find((candidata) =>
    ['initdb', 'pg_ctl', 'createdb'].every((nome) => fs.existsSync(path.join(candidata, nome + EXTENSAO))),
  );
  if (!pasta) {
    throw new Error('Não achei initdb, pg_ctl e createdb. Instale o PostgreSQL ou indique a pasta em PG_BIN.');
  }
  return (nome) => path.join(pasta, nome + EXTENSAO);
}

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

// stdio ignorado de propósito: o postgres herdaria os pipes do pg_ctl e o spawnSync nunca terminaria
function executar(executavel, argumentos, pastaDoLog) {
  const { status, error } = spawnSync(executavel, argumentos, { stdio: 'ignore' });
  if (status === 0) return;
  const logDoServidor = path.join(pastaDoLog, 'postgres.log');
  const log = fs.existsSync(logDoServidor) ? `\n${fs.readFileSync(logDoServidor, 'utf8')}` : '';
  throw new Error(`Falhou: ${path.basename(executavel)} ${argumentos[0]} (${error?.message ?? status})${log}`);
}

async function main() {
  const executavel = acharExecutaveis();
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'alexandria-pg-'));
  const dados = path.join(pasta, 'dados');
  const porta = await portaLivre();
  let servidorNoAr = false;

  // Sem isto, um Ctrl+C mataria este processo antes do finally e deixaria o postgres no ar
  for (const sinal of ['SIGINT', 'SIGTERM']) process.on(sinal, () => {});

  try {
    executar(
      executavel('initdb'),
      ['-D', dados, '-U', USUARIO, '--auth=trust', '--encoding=UTF8', '--locale=C', '--no-sync'],
      pasta,
    );

    const opcoes = [`-p ${porta}`, '-c listen_addresses=127.0.0.1', '-c fsync=off'];
    if (process.platform !== 'win32') opcoes.push(`-k ${pasta}`);
    executar(
      executavel('pg_ctl'),
      ['start', '-D', dados, '-w', '-t', '60', '-l', path.join(pasta, 'postgres.log'), '-o', opcoes.join(' ')],
      pasta,
    );
    servidorNoAr = true;

    executar(executavel('createdb'), ['-h', '127.0.0.1', '-p', String(porta), '-U', USUARIO, BANCO], pasta);

    // Nada de banco configurado chega à suíte: só o descartável
    const ambiente = { ...process.env };
    for (const nome of ['DATABASE_URL', 'DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'DB_MODE']) {
      delete ambiente[nome];
    }
    Object.assign(ambiente, {
      TEST_DATABASE_URL: `postgresql://${USUARIO}@127.0.0.1:${porta}/${BANCO}`,
      EXIGIR_POSTGRES_DE_TESTE: 'true',
      DB_SSL: 'false',
    });

    const arquivos = process.argv.length > 2 ? process.argv.slice(2) : SUITE;
    const { status } = spawnSync(process.execPath, ['--test', ...arquivos], {
      cwd: path.resolve(__dirname, '..'),
      env: ambiente,
      stdio: 'inherit',
    });
    process.exitCode = status ?? 1;
  } finally {
    if (servidorNoAr) spawnSync(executavel('pg_ctl'), ['stop', '-D', dados, '-m', 'immediate', '-w'], { stdio: 'ignore' });
    fs.rmSync(pasta, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
