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

ALTER TABLE users ADD COLUMN IF NOT EXISTS foto TEXT;

-- Pedidos de redefinição de senha
CREATE TABLE IF NOT EXISTS password_resets (
  id SERIAL PRIMARY KEY,                                        -- ID auto-incrementado
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- Dono do pedido
  token_hash CHAR(64) NOT NULL,                                 -- Hash SHA-256 do código de 6 dígitos (o código só vai no e-mail)
  expira_em TIMESTAMPTZ NOT NULL,                               -- Prazo do código
  usado_em TIMESTAMPTZ,                                         -- Preenchido quando o código é usado ou derrubado
  tentativas INTEGER NOT NULL DEFAULT 0,                        -- Tentativas gastas; depois da quinta o código para de valer
  criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP               -- Data do pedido
);

CREATE INDEX IF NOT EXISTS password_resets_user_id_idx ON password_resets (user_id);

-- Bancos criados na época do link: ganham o contador e perdem o UNIQUE do hash
ALTER TABLE password_resets ADD COLUMN IF NOT EXISTS tentativas INTEGER NOT NULL DEFAULT 0;
ALTER TABLE password_resets DROP CONSTRAINT IF EXISTS password_resets_token_hash_key;
