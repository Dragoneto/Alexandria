const jwt = require('jsonwebtoken');
const users = require('../repositories/userRepository');

// Este middleware verifica se o usuário está autenticado
// Ele é colocado ANTES das rotas que precisam de login
//
// O mobile envia o token no header assim:
//   Authorization: Bearer eyJhbGciOiJI...
//
// O middleware extrai o token, verifica se é válido,
// e adiciona os dados do usuário em req.user
const authMiddleware = async (req, res, next) => {
  try {
    // 1. Pegar o header Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: 'Token não fornecido',
      });
    }

    // 2. Extrair o token (remover o "Bearer " do início)
    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'Token mal formatado',
      });
    }

    // 3. Verificar e decodificar o token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Token válido de conta que não existe mais (ex.: banco zerado): a sessão não vale.
    // Ao zerar o banco, troque também o JWT_SECRET: os ids recomeçam e um token antigo abriria a conta nova de mesmo id
    if (!(await users.findById(decoded.id))) {
      return res.status(401).json({ error: 'Sessão inválida. Entre novamente.' });
    }

    // 4. Adicionar os dados do usuário na requisição
    //    Agora qualquer controller pode acessar req.user.id e req.user.email
    req.user = decoded;

    // 5. Continuar para o próximo middleware/controller
    next();

  } catch (error) {
    // Falha do banco é 500, e não 401: erro de infraestrutura não desloga ninguém
    if (!(error instanceof jwt.JsonWebTokenError)) {
      console.error('Erro ao conferir a sessão:', error.message);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
    return res.status(401).json({
      error: 'Token inválido ou expirado',
    });
  }
};

module.exports = authMiddleware;
