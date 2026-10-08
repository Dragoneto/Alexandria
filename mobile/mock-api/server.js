/**
 * Servidor falso das rotas de senha do backend (pasta backend/).
 *
 * Reproduz POST /api/auth/forgot-password e POST /api/auth/reset-password:
 * mesmos caminhos, mesmos status HTTP e o mesmo formato de erro ({ error }).
 * Responde como o backend com RESET_CODE_DEBUG=true: o código volta na resposta.
 * Serve para mexer no app sem subir o backend; para falar com o backend de
 * verdade basta trocar EXPO_PUBLIC_API_URL.
 *
 * Uso: npm run mock-api   (porta MOCK_API_PORT, padrão 8080)
 *
 * E-mails especiais:
 *   leitor@alexandria.com   conta cadastrada: devolve resetCode, o código de 6 dígitos
 *   erro500@alexandria.com  simula erro interno (500)
 *   lento@alexandria.com    responde depois de 20 s, acima do limite de 15 s do app
 */
const http = require('node:http');
const { randomInt } = require('node:crypto');

const REGISTERED_EMAIL = 'leitor@alexandria.com';
const SERVER_ERROR_EMAIL = 'erro500@alexandria.com';
const SLOW_EMAIL = 'lento@alexandria.com';
const FORGOT_PASSWORD_PATH = '/api/auth/forgot-password';
const RESET_PASSWORD_PATH = '/api/auth/reset-password';
const SENHA_MINIMA = 8;
const SENHA_REGRA = /^(?=.*[A-Za-zÀ-ÖØ-öø-ÿ])(?=.*\d).{8,}$/;
const CODIGO_FORMATO = /^\d{6}$/;
const MAX_TENTATIVAS = 5;
const TTL_MS = 15 * 60 * 1000;

// Mesmos textos do authController, para o app ver aqui o que veria em produção
const MENSAGEM_NEUTRA =
  'Se existir uma conta com esse e-mail, enviamos um código de 6 dígitos para criar uma nova senha.';
const CODIGO_INVALIDO = 'Código inválido ou expirado. Peça um novo.';
const INTERNAL_ERROR = { status: 500, body: { error: 'Erro interno do servidor' } };

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Código aberto de cada e-mail enquanto este processo estiver de pé; pedir de novo troca o anterior
const pedidos = new Map();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    ...CORS_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(body));
}

/** Lê o corpo como JSON; devolve null quando ele está vazio ou malformado. */
function readJson(request) {
  return new Promise((resolve) => {
    let raw = '';
    request.on('data', (chunk) => {
      raw += chunk;
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve(null);
      }
    });
  });
}

function normalizeEmail(body) {
  return typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
}

/** Mesmas regras do forgotPassword do backend. */
function forgotPassword(body) {
  if (body === null) {
    // Corpo ilegível cai no catch do controller, que responde 500
    return INTERNAL_ERROR;
  }

  const email = normalizeEmail(body);

  if (!email) {
    return { status: 400, body: { error: 'Email é obrigatório' } };
  }

  if (email === SERVER_ERROR_EMAIL) {
    return INTERNAL_ERROR;
  }

  // Só esta conta "existe" no mock; as outras recebem a mesma resposta, sem código
  if (email !== REGISTERED_EMAIL) {
    return { status: 200, body: { message: MENSAGEM_NEUTRA } };
  }

  const resetCode = String(randomInt(0, 1_000_000)).padStart(6, '0');
  pedidos.set(email, {
    codigo: resetCode,
    expiraEm: Date.now() + TTL_MS,
    usado: false,
    tentativas: 0,
  });

  return { status: 200, body: { message: MENSAGEM_NEUTRA, resetCode } };
}

/** Mesmas regras do resetPassword do backend, com os códigos que este mock emitiu. */
function resetPassword(body) {
  if (body === null) {
    return INTERNAL_ERROR;
  }

  const email = normalizeEmail(body);
  const codigo = typeof body?.codigo === 'string' ? body.codigo.trim() : '';
  const senha = typeof body?.senha === 'string' ? body.senha : '';

  if (!email || !CODIGO_FORMATO.test(codigo)) {
    return { status: 400, body: { error: CODIGO_INVALIDO } };
  }

  if (!SENHA_REGRA.test(senha)) {
    return {
      status: 400,
      body: {
        error: `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres, com letra e número`,
      },
    };
  }

  const pedido = pedidos.get(email);

  if (
    !pedido ||
    pedido.usado ||
    pedido.expiraEm <= Date.now() ||
    pedido.tentativas >= MAX_TENTATIVAS
  ) {
    return { status: 400, body: { error: CODIGO_INVALIDO } };
  }

  // A tentativa conta antes da comparação, como no backend: depois da quinta, nem o código certo passa
  pedido.tentativas += 1;

  if (pedido.codigo !== codigo) {
    return { status: 400, body: { error: CODIGO_INVALIDO } };
  }

  // Uso único, como no backend
  pedido.usado = true;

  return { status: 200, body: { message: 'Senha redefinida com sucesso!' } };
}

function createMockApi({ delayMs = 800, slowDelayMs = 20000, log = console.log } = {}) {
  return http.createServer(async (request, response) => {
    const path = new URL(request.url, 'http://mock').pathname;

    if (request.method === 'OPTIONS') {
      response.writeHead(204, CORS_HEADERS);
      response.end();
      return;
    }

    if (request.method !== 'POST' || ![FORGOT_PASSWORD_PATH, RESET_PASSWORD_PATH].includes(path)) {
      log(`${request.method} ${path} -> 404`);
      sendJson(response, 404, { error: 'Rota não disponível no mock' });
      return;
    }

    const body = await readJson(request);
    const pedindoCodigo = path === FORGOT_PASSWORD_PATH;
    const result = pedindoCodigo ? forgotPassword(body) : resetPassword(body);

    await sleep(pedindoCodigo && normalizeEmail(body) === SLOW_EMAIL ? slowDelayMs : delayMs);

    log(
      pedindoCodigo
        ? `POST ${path} email=${JSON.stringify(body?.email ?? null)} -> ${result.status}`
        : `POST ${path} -> ${result.status}`,
    );
    sendJson(response, result.status, result.body);
  });
}

if (require.main === module) {
  const port = Number(process.env.MOCK_API_PORT) || 8080;

  createMockApi().listen(port, '0.0.0.0', () => {
    console.log(`Mock da API em http://localhost:${port}`);
    console.log(`   POST ${FORGOT_PASSWORD_PATH} - Pedir código de redefinição`);
    console.log(`   POST ${RESET_PASSWORD_PATH}  - Definir a nova senha`);
    console.log(
      `E-mails especiais: ${REGISTERED_EMAIL} (cadastrado), ${SERVER_ERROR_EMAIL} (erro 500), ${SLOW_EMAIL} (lento)`,
    );
  });
}

module.exports = { createMockApi };
