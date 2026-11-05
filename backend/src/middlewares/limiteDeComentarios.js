// Limite de criação de comentários e respostas por conta, numa janela deslizante.
// shortcut: a contagem fica na memória deste processo; com N instâncias o limite real chega a N vezes o
// configurado, e proteger entre instâncias pediria um armazenamento compartilhado
function inteiroPositivo(valor, padrao) {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : padrao;
}

function criarLimite({ maximo, janelaMs }) {
  const envios = new Map(); // id da conta -> horários dos envios aceitos dentro da janela
  let proximaLimpeza = 0;

  return function limitarEnvios(req, res, next) {
    const agora = performance.now(); // relógio que só anda para frente: ajuste no relógio do sistema não mexe na janela
    if (agora >= proximaLimpeza) {
      // Esquece quem não envia há uma janela inteira, para o mapa não crescer sem fim
      for (const [conta, horarios] of envios) if (horarios.at(-1) <= agora - janelaMs) envios.delete(conta);
      proximaLimpeza = agora + janelaMs;
    }

    // Conferir e contar sem await no meio: envios simultâneos da mesma conta não passam juntos do limite
    const recentes = (envios.get(req.user.id) ?? []).filter((horario) => horario > agora - janelaMs);
    if (recentes.length >= maximo) {
      envios.set(req.user.id, recentes);
      const segundos = Math.ceil((recentes[0] + janelaMs - agora) / 1000);
      res.set('Retry-After', String(segundos));
      res.set('Access-Control-Expose-Headers', 'Retry-After'); // sem isso o app web não consegue ler o header
      return res.status(429).json({
        error: `Você enviou muitos comentários em pouco tempo. Tente de novo em ${segundos} ${segundos === 1 ? 'segundo' : 'segundos'}.`,
      });
    }
    recentes.push(agora);
    envios.set(req.user.id, recentes);
    return next();
  };
}

module.exports = criarLimite({
  maximo: inteiroPositivo(process.env.COMENTARIOS_LIMITE, 30),
  janelaMs: inteiroPositivo(process.env.COMENTARIOS_JANELA_SEGUNDOS, 60) * 1000,
});
module.exports.criarLimite = criarLimite;
