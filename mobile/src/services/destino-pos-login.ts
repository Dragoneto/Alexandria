// Rotas privadas que valem a volta depois do login: links de livro, avaliação, conversa e abas.
const ROTA_DE_VOLTA =
  /^\/(?:(?:livro|avaliacao|avaliar|comentario)\/[A-Za-z0-9_-]+|notificacoes|biblioteca|perfil|explore|minhas-avaliacoes)$/;

let destino: string | null = null;

/** Guarda a rota privada aberta por link antes do login; qualquer outra rota é ignorada. */
export function lembrarDestino(caminho: string | null | undefined) {
  destino = caminho && ROTA_DE_VOLTA.test(caminho) ? caminho : null;
}

/** A sessão já estava ativa: não há para onde voltar. */
export function descartarDestino() {
  destino = null;
}

/** Devolve a rota guardada uma única vez. */
export function consumirDestino(): string | null {
  const guardado = destino;
  destino = null;
  return guardado;
}
