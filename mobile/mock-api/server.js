/**
 * Servidor falso do endpoint POST /api/auth/forgot-password.
 *
 * Reproduz o backend Spring Boot do alexandria_web (AuthService e
 * GlobalExceptionHandler): mesmo caminho, mesmos status HTTP e mesmo formato
 * de JSON. Serve para testar o app enquanto o backend real estiver fora do ar;
 * para usar o backend real basta trocar EXPO_PUBLIC_API_URL.
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
const FRONTEND_URL = 'http://localhost:5173';
const FORGOT_PASSWORD_PATH = '/api/auth/forgot-password';

// Aproxima o @Email do backend, que aceita domínio sem ponto
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const INTERNAL_ERROR = { status: 500, body: { message: 'Erro interno do servidor', errors: null } };

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

function validationError(message) {
  return { status: 400, body: { message: 'Erro de validação', errors: { email: message } } };
}

/** Mesmas regras do AuthService.requestPasswordReset e das anotações do DTO. */
function forgotPassword(body) {
  if (body === null) {
    // No backend real, corpo ilegível cai no handler genérico de Exception
    return INTERNAL_ERROR;
  }

  const email = normalizeEmail(body);

  if (!email) {
    return validationError('O email é obrigatório');
  }

  if (!EMAIL_PATTERN.test(email)) {
    return validationError('Formato de email inválido');
  }

  if (email === SERVER_ERROR_EMAIL) {
    return INTERNAL_ERROR;
  }

  if (email === REGISTERED_EMAIL) {
    const resetToken = randomUUID();

    return {
      status: 200,
      body: {
        message: 'Link de redefinição gerado com sucesso.',
        resetToken,
        resetUrl: `${FRONTEND_URL}/redefinir-senha?token=${resetToken}`,
      },
    };
  }

  return {
    status: 200,
    body: {
      message: 'Se o email existir, um link de redefinição será enviado.',
      resetToken: null,
      resetUrl: null,
    },
  };
}

function createMockApi({ delayMs = 800, slowDelayMs = 20000, log = console.log } = {}) {
  return http.createServer(async (request, response) => {
    const path = new URL(request.url, 'http://mock').pathname;

    if (request.method === 'OPTIONS') {
      response.writeHead(204, CORS_HEADERS);
      response.end();
      return;
    }

    if (request.method !== 'POST' || path !== FORGOT_PASSWORD_PATH) {
      log(`${request.method} ${path} -> 404`);
      sendJson(response, 404, { message: 'Rota não disponível no mock', errors: null });
      return;
    }

    const body = await readJson(request);
    const result = forgotPassword(body);

    await sleep(normalizeEmail(body) === SLOW_EMAIL ? slowDelayMs : delayMs);

    log(`POST ${path} email=${JSON.stringify(body?.email ?? null)} -> ${result.status}`);
    sendJson(response, result.status, result.body);
  });
}

if (require.main === module) {
  const port = Number(process.env.MOCK_API_PORT) || 8080;

  createMockApi().listen(port, '0.0.0.0', () => {
    console.log(`Mock da API em http://localhost:${port}${FORGOT_PASSWORD_PATH}`);
    console.log(
      `E-mails especiais: ${REGISTERED_EMAIL} (cadastrado), ${SERVER_ERROR_EMAIL} (erro 500), ${SLOW_EMAIL} (lento)`,
    );
  });
}

module.exports = { createMockApi };
