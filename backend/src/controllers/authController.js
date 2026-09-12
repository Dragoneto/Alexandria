const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

// ==========================================
// CADASTRO - POST /api/auth/register
// ==========================================
const register = async (req, res) => {
  try {
    const { nome, email, senha } = req.body;

    // 1. Validar se todos os campos foram enviados
    if (!nome || !email || !senha) {
      return res.status(400).json({
        error: 'Todos os campos são obrigatórios (nome, email, senha)',
      });
    }

    // 2. Verificar se o email já está cadastrado
    const usuarioExistente = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (usuarioExistente.rows.length > 0) {
      return res.status(409).json({
        error: 'Este email já está cadastrado',
      });
    }

    // 3. Hashear a senha com bcrypt (10 rounds de salt)
    //    Isso transforma "minhasenha123" em algo como "$2b$10$xK..."
    //    Mesmo que o banco seja invadido, a senha original não fica exposta
    const saltRounds = 10;
    const senhaHash = await bcrypt.hash(senha, saltRounds);

    // 4. Inserir o usuário no banco
    const novoUsuario = await pool.query(
      'INSERT INTO users (nome, email, senha_hash) VALUES ($1, $2, $3) RETURNING id, nome, email, criado_em',
      [nome, email, senhaHash]
    );

    // 5. Retornar o usuário criado (sem a senha!)
    return res.status(201).json({
      message: 'Usuário cadastrado com sucesso!',
      user: novoUsuario.rows[0],
    });

  } catch (error) {
    console.error('Erro no cadastro:', error.message);
    return res.status(500).json({
      error: 'Erro interno do servidor',
    });
  }
};

// ==========================================
// LOGIN - POST /api/auth/login
// ==========================================
const login = async (req, res) => {
  try {
    const { email, senha } = req.body;

    // 1. Validar campos
    if (!email || !senha) {
      return res.status(400).json({
        error: 'Email e senha são obrigatórios',
      });
    }

    // 2. Buscar o usuário pelo email
    const resultado = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (resultado.rows.length === 0) {
      return res.status(401).json({
        error: 'Email ou senha incorretos',
      });
    }

    const usuario = resultado.rows[0];

    // 3. Comparar a senha enviada com o hash salvo no banco
    //    bcrypt.compare() hasheia a senha enviada e compara com o hash salvo
    const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);

    if (!senhaCorreta) {
      return res.status(401).json({
        error: 'Email ou senha incorretos',
      });
    }

    // 4. Gerar o token JWT
    //    O token contém o ID e email do usuário, e expira em 7 dias
    //    O mobile vai salvar esse token e enviar em cada requisição
    const token = jwt.sign(
      { id: usuario.id, email: usuario.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // 5. Retornar o token e dados do usuário (sem a senha!)
    return res.status(200).json({
      message: 'Login realizado com sucesso!',
      token,
      user: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
      },
    });

  } catch (error) {
    console.error('Erro no login:', error.message);
    return res.status(500).json({
      error: 'Erro interno do servidor',
    });
  }
};

// ==========================================
// PERFIL - GET /api/auth/profile (rota protegida)
// ==========================================
const getProfile = async (req, res) => {
  try {
    // req.user vem do middleware de autenticação (já verificou o JWT)
    const resultado = await pool.query(
      'SELECT id, nome, email, criado_em FROM users WHERE id = $1',
      [req.user.id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        error: 'Usuário não encontrado',
      });
    }

    return res.status(200).json({
      user: resultado.rows[0],
    });

  } catch (error) {
    console.error('Erro ao buscar perfil:', error.message);
    return res.status(500).json({
      error: 'Erro interno do servidor',
    });
  }
};

module.exports = { register, login, getProfile };
