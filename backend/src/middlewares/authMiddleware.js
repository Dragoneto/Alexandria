const jwt = require('jsonwebtoken');

// Este middleware verifica se o usuário está autenticado
// Ele é colocado ANTES das rotas que precisam de login
//
// O mobile envia o token no header assim:
//   Authorization: Bearer eyJhbGciOiJI...
//
// O middleware extrai o token, verifica se é válido,
// e adiciona os dados do usuário em req.user
const authMiddleware = (req, res, next) => {
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

    // 4. Adicionar os dados do usuário na requisição
    //    Agora qualquer controller pode acessar req.user.id e req.user.email
    req.user = decoded;

    // 5. Continuar para o próximo middleware/controller
    next();

  } catch (error) {
    return res.status(401).json({
      error: 'Token inválido ou expirado',
    });
  }
};

module.exports = authMiddleware;
