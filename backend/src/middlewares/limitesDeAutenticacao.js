const { criarLimite } = require('./limiteDeComentarios');

const MINUTO = 60 * 1000;

function emailDoCorpo(req) {
  return typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
}

function espera(segundos) {
  if (segundos < 60) return `${segundos} ${segundos === 1 ? 'segundo' : 'segundos'}`;
  const minutos = Math.ceil(segundos / 60);
  return `${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`;
}

function limitePorEmail(maximo, janelaMs, aviso) {
  return criarLimite({
    maximo,
    janelaMs,
    chave: emailDoCorpo,
    mensagem: (segundos) => `${aviso} Tente de novo em ${espera(segundos)}.`,
  });
}

module.exports = {
  login: limitePorEmail(10, 15 * MINUTO, 'Muitas tentativas de entrar com este e-mail.'),
  pedidoDeCodigo: [
    limitePorEmail(1, MINUTO, 'Você acabou de pedir um código.'),
    limitePorEmail(5, 60 * MINUTO, 'Você pediu muitos códigos.'),
  ],
  redefinicao: limitePorEmail(10, 60 * MINUTO, 'Muitas tentativas de redefinir a senha.'),
  espera,
};
