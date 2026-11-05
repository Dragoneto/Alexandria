// O erro de JSON malformado traz um trecho do corpo na mensagem, e o corpo pode ter senha.
// O tratador padrão do Express escreve esse trecho no log e, fora de produção, na resposta
const jsonErrorHandler = (error, req, res, next) => {
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'O corpo da requisição não é um JSON válido' });
  }
  return next(error);
};

module.exports = jsonErrorHandler;
