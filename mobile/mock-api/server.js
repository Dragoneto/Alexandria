/**
 * Servidor falso das rotas de senha do backend (pasta backend/).
 *
 * Reproduz POST /api/auth/forgot-password e POST /api/auth/reset-password:
 * mesmos caminhos, mesmos status HTTP e o mesmo formato de erro ({ error }).
 * Serve para mexer no app sem subir o backend; para falar com o backend de
 * verdade basta trocar EXPO_PUBLIC_API_URL.
 *
 * Uso: npm run mock-api   (porta MOCK_API_PORT, padrão 8080)
 *
 * E-mails especiais:
 *   leitor@alexandria.com   conta cadastrada: devolve resetToken e resetUrl
 *   erro500@alexandria.com  simula erro interno (500)
 *   lento@alexandria.com    responde depois de 20 s, acima do limite de 15 s do app
 */
const http = require('node:http');
const { randomUUID } = require('node:crypto');

const REGISTERED_EMAIL = 'leitor@alexandria.com';
const SERVER_ERROR_EMAIL = 'erro500@alexandria.com';
const SLOW_EMAIL = 'lento@alexandria.com';
const RESET_URL_BASE = 'alexandriamobile://redefinir-senha';
const FORGOT_PASSWORD_PATH = '/api/auth/forgot-password';
const RESET_PASSWORD_PATH = '/api/auth/reset-password';
const SENHA_MINIMA = 8;
const TTL_MS = 30 * 60 * 1000;

// Mesmos textos do authController, para o app ver aqui o que veria em produção
const MENSAGEM_NEUTRA =
  'Se existir uma conta com esse e-mail, enviamos o link para criar uma nova senha.';
const LINK_INVALIDO = 'Link inválido ou expirado. Peça um novo.';
const INTERNAL_ERROR = { status: 500, body: { error: 'Erro interno do servidor' } };

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Tokens emitidos enquanto este processo estiver de pé
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

  // Só esta conta "existe" no mock; as outras recebem a mesma resposta, sem token
  if (email !== REGISTERED_EMAIL) {
    return { status: 200, body: { message: MENSAGEM_NEUTRA } };
  }

  const resetToken = randomUUID();
  pedidos.set(resetToken, { expiraEm: Date.now() + TTL_MS, usado: false });

  return {
    status: 200,
    body: {
      message: MENSAGEM_NEUTRA,
      resetToken,
      resetUrl: `${RESET_URL_BASE}?token=${resetToken}`,
    },
  };
}

/** Mesmas regras do resetPassword do backend, com os tokens que este mock emitiu. */
function resetPassword(body) {
  if (body === null) {
    return INTERNAL_ERROR;
  }

  const token = typeof body?.token === 'string' ? body.token.trim() : '';
  const senha = typeof body?.senha === 'string' ? body.senha : '';

  if (!token) {
    return { status: 400, body: { error: LINK_INVALIDO } };
  }

  if (senha.length < SENHA_MINIMA) {
    return {
      status: 400,
      body: { error: `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres` },
    };
  }

  const pedido = pedidos.get(token);

  if (!pedido || pedido.usado || pedido.expiraEm <= Date.now()) {
    return { status: 400, body: { error: LINK_INVALIDO } };
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
    const pedindoLink = path === FORGOT_PASSWORD_PATH;
    const result = pedindoLink ? forgotPassword(body) : resetPassword(body);

    await sleep(pedindoLink && normalizeEmail(body) === SLOW_EMAIL ? slowDelayMs : delayMs);

    log(
      pedindoLink
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
    console.log(`   POST ${FORGOT_PASSWORD_PATH} - Pedir link de redefinição`);
    console.log(`   POST ${RESET_PASSWORD_PATH}  - Definir a nova senha`);
    console.log(
      `E-mails especiais: ${REGISTERED_EMAIL} (cadastrado), ${SERVER_ERROR_EMAIL} (erro 500), ${SLOW_EMAIL} (lento)`,
    );
  });
}

module.exports = { createMockApi };
