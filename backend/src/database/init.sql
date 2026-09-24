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

-- Pedidos de redefinição de senha
CREATE TABLE IF NOT EXISTS password_resets (
  id SERIAL PRIMARY KEY,                                        -- ID auto-incrementado
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- Dono do pedido
  token_hash CHAR(64) UNIQUE NOT NULL,                          -- Hash SHA-256 do token do link (o token inteiro só vai no e-mail)
  expira_em TIMESTAMPTZ NOT NULL,                               -- Prazo do link
  usado_em TIMESTAMPTZ,                                         -- Preenchido quando o link é usado ou derrubado
  criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP               -- Data do pedido
);

CREATE INDEX IF NOT EXISTS password_resets_user_id_idx ON password_resets (user_id);
