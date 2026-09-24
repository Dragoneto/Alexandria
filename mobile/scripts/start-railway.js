/**
 * Inicia o app apontando para o backend publicado no Railway.
 *
 * Lê o .env.production, valida o endereço e roda o expo start com essas
 * variáveis já no ambiente do processo. O Expo não sobrescreve variável que
 * já existe, então nenhum arquivo .env local muda o destino das requisições.
 *
 * Uso: npm run start:railway
 * Argumentos extras vão para o expo start (ex.: npm run start:railway -- --android)
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const URL_KEY = 'EXPO_PUBLIC_API_URL';
const PRODUCTION_ENV_FILE = path.join(__dirname, '..', '.env.production');

/** Lê um arquivo .env inteiro. A última ocorrência de cada chave é a que vale. */
function readEnvFile(filePath) {
  const values = {};

  if (!fs.existsSync(filePath)) {
    return values;
  }

  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);

    if (!match) {
      continue;
    }

    const raw = match[2].trim();
    const quoted = raw.match(/^(['"])(.*)\1$/);

    values[match[1]] = quoted ? quoted[2] : raw.replace(/\s+#.*$/, '').trim();
  }

  return values;
}

/** Mesmas regras de src/constants/env.ts, com mensagens para quem está colando o link. */
function checkRailwayUrl(value) {
  const candidate = (value ?? '').trim();

  if (!candidate) {
    return {
      ok: false,
      message: 'O link do Railway ainda não está em mobile/.env.production (EXPO_PUBLIC_API_URL).',
    };
  }

  let url;

  try {
    url = new URL(candidate);
  } catch {
    return {
      ok: false,
      message: 'O link do Railway precisa ser um endereço http:// ou https:// válido.',
    };
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    return { ok: false, message: 'O link do Railway precisa começar com http:// ou https://.' };
  }

  if (url.username || url.password || url.search || url.hash) {
    return {
      ok: false,
      message: 'Cole só o endereço do backend: sem usuário, senha, ? ou # no link.',
    };
  }

  const normalized = url.toString().replace(/\/+$/, '');

  if (/\/api$/i.test(normalized)) {
    return {
      ok: false,
      message: 'Cole só o endereço do backend, sem /api no final: o app já monta /api/auth/...',
    };
  }

  return { ok: true, url: normalized };
}

function main() {
  const values = readEnvFile(PRODUCTION_ENV_FILE);
  const result = checkRailwayUrl(values[URL_KEY]);

  if (!result.ok) {
    console.error(result.message);
    process.exit(1);
  }

  console.log(`API: ${result.url} (Railway)`);

  const publicVars = Object.fromEntries(
    Object.entries(values).filter(([key, value]) => key.startsWith('EXPO_PUBLIC_') && value !== ''),
  );

  const expoCli = path.join(path.dirname(require.resolve('expo/package.json')), 'bin', 'cli');
  const child = spawn(process.execPath, [expoCli, 'start', ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: { ...process.env, ...publicVars, [URL_KEY]: result.url },
  });

  child.on('error', (error) => {
    console.error(`Não foi possível iniciar o Expo: ${error.message}`);
    process.exit(1);
  });

  child.on('exit', (code) => process.exit(code ?? 1));
}

if (require.main === module) {
  main();
}

module.exports = { checkRailwayUrl, readEnvFile };
