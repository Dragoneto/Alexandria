const crypto = require('node:crypto');

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const users = require('../repositories/userRepository');
const passwordResets = require('../repositories/passwordResetRepository');

// Regras da redefinição de senha
const SENHA_MINIMA = 8;
const SENHA_REGRA = /^(?=.*[A-Za-zÀ-ÖØ-öø-ÿ])(?=.*\d).{8,}$/;
const SENHA_FRACA = `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres, com letra e número`;
const TTL_MINUTOS = Number(process.env.RESET_TOKEN_TTL_MINUTES) > 0
  ? Number(process.env.RESET_TOKEN_TTL_MINUTES)
  : 15;
const CODIGO_FORMATO = /^\d{6}$/;
// Com 6 dígitos, chutar precisa custar caro: depois de cinco tentativas o código para de valer
const MAX_TENTATIVAS = 5;
// Fora de produção o código volta na resposta, para testar sem abrir a caixa de e-mail
const EXPOE_CODIGO = process.env.NODE_ENV !== 'production';
// Mesma resposta para e-mail cadastrado ou não, para não revelar quem tem conta
const MENSAGEM_NEUTRA =
  'Se existir uma conta com esse e-mail, enviamos um código de 6 dígitos para criar uma nova senha.';
const CODIGO_INVALIDO = 'Código inválido ou expirado. Peça um novo.';
const FOTO_FORMATO = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const FOTO_TAMANHO_MAXIMO = 300 * 1024;

// ==========================================
// CADASTRO - POST /api/auth/register
// ==========================================
const register = async (req, res) => {
  try {
    const nome = typeof req.body?.nome === 'string' ? req.body.nome.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const senha = typeof req.body?.senha === 'string' ? req.body.senha : '';

    // 1. Validar se todos os campos foram enviados
    if (!nome || !email || !senha) {
      return res.status(400).json({
        error: 'Todos os campos são obrigatórios (nome, email, senha)',
      });
    }

    if (!SENHA_REGRA.test(senha)) {
      return res.status(400).json({ error: SENHA_FRACA });
    }

    // 2. Verificar se o email já está cadastrado
    const usuarioExistente = await users.findByEmail(email);

    if (usuarioExistente) {
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
    const usuarioCriado = await users.create({ nome, email, senhaHash });

    // 5. Gerar o token JWT (igual o login faz)
    const token = jwt.sign(
      { id: usuarioCriado.id, email: usuarioCriado.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // 6. Retornar o token junto com o usuário criado
    return res.status(201).json({
      message: 'Usuário cadastrado com sucesso!',
      token,
      user: usuarioCriado,
    });

  } catch (error) {
    if (error.code === 'DUPLICATE_EMAIL' || error.code === '23505') {
      return res.status(409).json({ error: 'Este email já está cadastrado' });
    }
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
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const senha = typeof req.body?.senha === 'string' ? req.body.senha : '';

    // 1. Validar campos
    if (!email || !senha) {
      return res.status(400).json({
        error: 'Email e senha são obrigatórios',
      });
    }

    // 2. Buscar o usuário pelo email
    const usuario = await users.findByEmail(email);

    if (!usuario) {
      return res.status(401).json({
        error: 'Email ou senha incorretos',
      });
    }

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
    const usuario = await users.findById(req.user.id);

    if (!usuario) {
      return res.status(404).json({
        error: 'Usuário não encontrado',
      });
    }

    return res.status(200).json({
      user: usuario,
    });

  } catch (error) {
    console.error('Erro ao buscar perfil:', error.message);
    return res.status(500).json({
      error: 'Erro interno do servidor',
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const nome = typeof req.body?.nome === 'string' ? req.body.nome.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';

    if (!nome || !email) {
      return res.status(400).json({
        error: 'Nome e email são obrigatórios',
      });
    }

    const usuarioAtualizado = await users.update(req.user.id, { nome, email });

    if (!usuarioAtualizado) {
      return res.status(404).json({
        error: 'Usuário não encontrado',
      });
    }

    return res.status(200).json({
      message: 'Perfil atualizado com sucesso!',
      user: usuarioAtualizado,
    });

  } catch (error) {
    if (error.code === 'DUPLICATE_EMAIL' || error.code === '23505') {
      return res.status(409).json({ error: 'Este email já está cadastrado' });
    }
    console.error('Erro ao atualizar perfil:', error.message);
    return res.status(500).json({
      error: 'Erro interno do servidor',
    });
  }
};

// ==========================================
// PEDIR REDEFINIÇÃO - POST /api/auth/forgot-password
// ==========================================
const forgotPassword = async (req, res) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';

    // 1. Validar o campo
    if (!email) {
      return res.status(400).json({
        error: 'Email é obrigatório',
      });
    }

    // 2. Buscar o usuário. Se não existir, a resposta é a mesma de quem existe
    const usuario = await users.findByEmail(email);

    if (!usuario) {
      return res.status(200).json({ message: MENSAGEM_NEUTRA });
    }

    // 3. Sortear o código e guardar o pedido (o armazenamento só vê o hash).
    //    Um código novo derruba o anterior: só vale o último pedido
    const codigo = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    const expiraEm = new Date(Date.now() + TTL_MINUTOS * 60 * 1000);

    await passwordResets.invalidateForUser(usuario.id);
    await passwordResets.create({ userId: usuario.id, token: codigo, expiraEm });

    // 4. Enquanto não existe envio de e-mail, o código sai no log do servidor
    console.log(`🔑 Código de redefinição para ${email} (vale ${TTL_MINUTOS} min): ${codigo}`);

    // 5. Fora de produção o código volta na resposta, para dar para testar sem e-mail
    return res.status(200).json({
      message: MENSAGEM_NEUTRA,
      ...(EXPOE_CODIGO ? { resetCode: codigo } : {}),
    });

  } catch (error) {
    console.error('Erro ao pedir redefinição de senha:', error.message);
    return res.status(500).json({
      error: 'Erro interno do servidor',
    });
  }
};

// ==========================================
// REDEFINIR SENHA - POST /api/auth/reset-password
// ==========================================
const resetPassword = async (req, res) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const codigo = typeof req.body?.codigo === 'string' ? req.body.codigo.trim() : '';
    const senha = typeof req.body?.senha === 'string' ? req.body.senha : '';

    // 1. Validar os campos
    if (!email || !CODIGO_FORMATO.test(codigo)) {
      return res.status(400).json({ error: CODIGO_INVALIDO });
    }

    if (!SENHA_REGRA.test(senha)) {
      return res.status(400).json({ error: SENHA_FRACA });
    }

    // 2. Achar o pedido aberto da conta e gastar uma tentativa antes de comparar o código.
    //    Depois de cinco tentativas o pedido se esgota, e nem o código certo passa
    const usuario = await users.findByEmail(email);
    const pedido = usuario ? await passwordResets.findOpenByUser(usuario.id) : null;
    const podeTentar = pedido && (await passwordResets.claimAttempt(pedido.id, MAX_TENTATIVAS));

    if (!podeTentar || !passwordResets.matches(pedido, codigo)) {
      return res.status(400).json({ error: CODIGO_INVALIDO });
    }

    // 3. Trocar a senha pelo hash da nova
    const saltRounds = 10;
    const senhaHash = await bcrypt.hash(senha, saltRounds);
    const usuarioAtualizado = await users.updatePassword(pedido.user_id, senhaHash);

    if (!usuarioAtualizado) {
      return res.status(400).json({ error: CODIGO_INVALIDO });
    }

    // 4. O código usado não vale de novo
    await passwordResets.invalidateForUser(pedido.user_id);

    return res.status(200).json({
      message: 'Senha redefinida com sucesso!',
    });

  } catch (error) {
    console.error('Erro ao redefinir senha:', error.message);
    return res.status(500).json({
      error: 'Erro interno do servidor',
    });
  }
};

const getPhoto = async (req, res) => {
  try {
    const resultado = await users.findPhoto(req.user.id);

    if (!resultado) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    return res.status(200).json({ foto: resultado.foto });
  } catch (error) {
    console.error('Erro ao buscar foto de perfil:', error.message);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const updatePhoto = async (req, res) => {
  try {
    const foto = typeof req.body?.foto === 'string' ? req.body.foto : '';

    if (!FOTO_FORMATO.test(foto)) {
      return res.status(400).json({ error: 'Envie uma imagem JPG, PNG ou WebP' });
    }

    if (foto.length > FOTO_TAMANHO_MAXIMO) {
      return res.status(413).json({ error: 'A foto é grande demais' });
    }

    const atualizado = await users.updatePhoto(req.user.id, foto);

    if (!atualizado) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    return res.status(200).json({ message: 'Foto de perfil atualizada!', foto });
  } catch (error) {
    console.error('Erro ao salvar foto de perfil:', error.message);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const deletePhoto = async (req, res) => {
  try {
    const atualizado = await users.updatePhoto(req.user.id, null);

    if (!atualizado) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    return res.status(200).json({ message: 'Foto de perfil removida!', foto: null });
  } catch (error) {
    console.error('Erro ao remover foto de perfil:', error.message);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  forgotPassword,
  resetPassword,
  getPhoto,
  updatePhoto,
  deletePhoto,
};
