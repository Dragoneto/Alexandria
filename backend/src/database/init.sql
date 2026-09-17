-- Criar o banco de dados (rodar manualmente se necessário)
-- CREATE DATABASE alexandria;

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,              -- ID auto-incrementado
  nome VARCHAR(100) NOT NULL,          -- Nome do usuário
  email VARCHAR(255) UNIQUE NOT NULL,  -- Email único (não pode repetir)
  senha_hash VARCHAR(255) NOT NULL,    -- Senha hasheada com bcrypt (nunca texto puro!)
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP  -- Data de criação automática
);
