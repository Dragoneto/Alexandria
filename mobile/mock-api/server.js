/**
 * Servidor falso da API de autenticação do Alexandria.
 *
 * Reproduz o backend Spring Boot do alexandria_web (AuthController, AuthService
 * e GlobalExceptionHandler): mesmos caminhos, mesmos status HTTP e mesmo formato
 * de JSON. Serve para desenvolver o app enquanto o backend real estiver fora do
 * ar; para usar o backend real basta trocar EXPO_PUBLIC_API_URL.
 *
 * Uso: npm run mock-api   (porta MOCK_API_PORT, padrão 8080)
 *
 * Rotas:
 *   POST /api/auth/register          name, email, password
 *   POST /api/auth/login             email, password
 *   GET  /api/auth/profile           exige Authorization: Bearer <token>
 *   PUT  /api/auth/profile           name, email (exige token)
 *   POST /api/auth/forgot-password   email
 *
 * Os usuários ficam em memória: reiniciar o servidor apaga os cadastros.
 * Conta pronta para testar login sem cadastrar antes:
 *   leitor@alexandria.com / senha12345
 *
 * E-mails especiais no forgot-password:
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

// Aproxima o @Email do backend, que aceita domínio sem ponto
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const INTERNAL_ERROR = { status: 500, body: { message: 'Erro interno do servidor', errors: null } };

// ---------------------------------------------------------------- estado

/** email -> { id, name, email, password } */
const users = new Map();
/** token -> email */
const sessions = new Map();
let nextId = 1;

function seed() {
  const email = REGISTERED_EMAIL;
  users.set(email, { id: nextId++, name: 'Leitor de Teste', email, password: 'senha12345' });
}

seed();

// ---------------------------------------------------------------- helpers

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

/** Mesmo formato do GlobalExceptionHandler para MethodArgumentNotValidException. */
function validationError(errors) {
  return { status: 400, body: { message: 'Erro de validação', errors } };
}

/** AuthResponse do backend: token, email, name, userId. */
function authResponse(user) {
  const token = randomUUID();
  sessions.set(token, user.email);

  return {
    status: 200,
    body: { token, email: user.email, name: user.name, userId: user.id },
  };
}

/** Lê o Bearer token e devolve o usuário, ou null. */
function userFromRequest(request) {
  const header = request.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const email = sessions.get(token);

  return email ? (users.get(email) ?? null) : null;
}

const UNAUTHORIZED = {
  status: 401,
  body: { message: 'Credenciais inválidas', errors: null },
};

// ---------------------------------------------------------------- rotas

/** Regras do RegisterRequest: name 2-120, email válido, password 8-100. */
function register(body) {
  if (body === null) return INTERNAL_ERROR;

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = normalizeEmail(body);
  const password = typeof body.password === 'string' ? body.password : '';
  const errors = {};

  if (!name) errors.name = 'O nome é obrigatório';
  else if (name.length < 2 || name.length > 120)
    errors.name = 'O nome deve ter entre 2 e 120 caracteres';

  if (!email) errors.email = 'O email é obrigatório';
  else if (!EMAIL_PATTERN.test(email)) errors.email = 'Formato de email inválido';

  if (!password) errors.password = 'A senha é obrigatória';
  else if (password.length < 8 || password.length > 100)
    errors.password = 'A senha deve ter no mínimo 8 caracteres';

  if (Object.keys(errors).length > 0) return validationError(errors);

  if (users.has(email)) {
    return {
      status: 409,
      body: { message: 'Email já cadastrado', errors: { email: 'Email já cadastrado' } },
    };
  }

  const user = { id: nextId++, name, email, password };
  users.set(email, user);

  return { ...authResponse(user), status: 201 };
}

/** Regras do LoginRequest: email válido e senha não vazia. */
function login(body) {
  if (body === null) return INTERNAL_ERROR;

  const email = normalizeEmail(body);
  const password = typeof body.password === 'string' ? body.password : '';
  const errors = {};

  if (!email) errors.email = 'O email é obrigatório';
  else if (!EMAIL_PATTERN.test(email)) errors.email = 'Formato de email inválido';

  if (!password) errors.password = 'A senha é obrigatória';

  if (Object.keys(errors).length > 0) return validationError(errors);

  const user = users.get(email);

  if (!user || user.password !== password) return UNAUTHORIZED;

  return authResponse(user);
}

/** UserProfileResponse: id, name, email. */
function getProfile(request) {
  const user = userFromRequest(request);

  if (!user) return UNAUTHORIZED;

  return { status: 200, body: { id: user.id, name: user.name, email: user.email } };
}

/** UpdateProfileRequest: name 2-120 e email válido; devolve AuthResponse. */
function updateProfile(request, body) {
  const user = userFromRequest(request);

  if (!user) return UNAUTHORIZED;
  if (body === null) return INTERNAL_ERROR;

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = normalizeEmail(body);
  const errors = {};

  if (!name) errors.name = 'O nome é obrigatório';
  else if (name.length < 2 || name.length > 120)
    errors.name = 'O nome deve ter entre 2 e 120 caracteres';

  if (!email) errors.email = 'O email é obrigatório';
  else if (!EMAIL_PATTERN.test(email)) errors.email = 'Formato de email inválido';

  if (Object.keys(errors).length > 0) return validationError(errors);

  if (email !== user.email && users.has(email)) {
    return {
      status: 409,
      body: { message: 'Email já cadastrado', errors: { email: 'Email já cadastrado' } },
    };
  }

  users.delete(user.email);
  user.name = name;
  user.email = email;
  users.set(email, user);

  // As sessões guardam o email; realinha as que apontavam para o antigo.
  for (const [token, sessionEmail] of sessions.entries()) {
    if (sessionEmail !== email && users.get(sessionEmail) === undefined) {
      sessions.set(token, email);
    }
  }

  return { status: 200, body: { token: '', email: user.email, name: user.name, userId: user.id } };
}

/** Mesmas regras do AuthService.requestPasswordReset. */
function forgotPassword(body) {
  if (body === null) return INTERNAL_ERROR;

  const email = normalizeEmail(body);

  if (!email) return validationError({ email: 'O email é obrigatório' });
  if (!EMAIL_PATTERN.test(email)) return validationError({ email: 'Formato de email inválido' });
  if (email === SERVER_ERROR_EMAIL) return INTERNAL_ERROR;

  if (users.has(email)) {
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

// ---------------------------------------------------------------- servidor

function createMockApi({ delayMs = 800, slowDelayMs = 20000, log = console.log } = {}) {
  return http.createServer(async (request, response) => {
    const path = new URL(request.url, 'http://mock').pathname;
    const method = request.method;

    if (method === 'OPTIONS') {
      response.writeHead(204, CORS_HEADERS);
      response.end();
      return;
    }

    const needsBody = method === 'POST' || method === 'PUT';
    const body = needsBody ? await readJson(request) : null;

    let result = null;

    if (method === 'POST' && path === '/api/auth/register') result = register(body);
    else if (method === 'POST' && path === '/api/auth/login') result = login(body);
    else if (method === 'GET' && path === '/api/auth/profile') result = getProfile(request);
    else if (method === 'PUT' && path === '/api/auth/profile')
      result = updateProfile(request, body);
    else if (method === 'POST' && path === '/api/auth/forgot-password')
      result = forgotPassword(body);

    if (result === null) {
      log(`${method} ${path} -> 404`);
      sendJson(response, 404, { message: 'Rota não disponível no mock', errors: null });
      return;
    }

    await sleep(normalizeEmail(body) === SLOW_EMAIL ? slowDelayMs : delayMs);

    log(`${method} ${path} -> ${result.status}`);
    sendJson(response, result.status, result.body);
  });
}

if (require.main === module) {
  const port = Number(process.env.MOCK_API_PORT) || 8080;

  createMockApi().listen(port, '0.0.0.0', () => {
    console.log(`Mock da API em http://localhost:${port}`);
    console.log(`Conta pronta: ${REGISTERED_EMAIL} / senha12345`);
    console.log(
      `E-mails especiais: ${SERVER_ERROR_EMAIL} (erro 500), ${SLOW_EMAIL} (lento, 20 s)`,
    );
  });
}

module.exports = { createMockApi };