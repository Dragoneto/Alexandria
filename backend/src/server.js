// Carregar variáveis de ambiente ANTES de tudo
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// MIDDLEWARES GLOBAIS
// ==========================================

// CORS - permite que o mobile (e qualquer origem) acesse a API
app.use(cors());

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
  });
});

// Rotas de autenticação
app.use('/api/auth', authRoutes);

// ==========================================
// INICIAR SERVIDOR
// ==========================================
app.listen(PORT, () => {
  console.log(`🏛️ Alexandria API rodando em http://localhost:${PORT}`);
  console.log(`📍 Rotas disponíveis:`);
  console.log(`   POST /api/auth/register  - Cadastrar usuário`);
  console.log(`   POST /api/auth/login     - Fazer login`);
  console.log(`   GET  /api/auth/profile   - Ver perfil (requer token)`);
});
