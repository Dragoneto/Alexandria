// Carregar variáveis de ambiente ANTES de tudo
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const users = require('./repositories/userRepository');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// MIDDLEWARES GLOBAIS
// ==========================================

// CORS - permite que o mobile (e qualquer origem) acesse a API
const configuredOrigins = process.env.CORS_ORIGINS?.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: configuredOrigins?.length ? configuredOrigins : '*',
  }),
);

// Parsear JSON do body das requisições
app.use(express.json());

// ==========================================
// ROTAS
// ==========================================

// Health check - para testar se o servidor está rodando
app.get('/', (req, res) => {
  res.json({
    message: '🏛️ Alexandria API está rodando!',
    version: '1.0.0',
    storage: users.mode,
  });
});

// Rotas de autenticação
app.use('/api/auth', authRoutes);

// ==========================================
// INICIAR SERVIDOR
// ==========================================
async function start() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET não configurado. Crie backend/.env antes de iniciar.');
  }

  await users.initialize();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🏛️ Alexandria API rodando em http://localhost:${PORT}`);
    console.log(`💾 Persistência: ${users.mode}`);
    console.log(`📍 Rotas disponíveis:`);
    console.log(`   POST /api/auth/register  - Cadastrar usuário`);
    console.log(`   POST /api/auth/login     - Fazer login`);
    console.log(`   GET  /api/auth/profile   - Ver perfil (requer token)`);
  });
}

start().catch((error) => {
  console.error(`❌ Não foi possível iniciar a API: ${error.message}`);
  process.exit(1);
});
