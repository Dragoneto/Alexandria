const comentarios = require('../repositories/comentarioRepository');
const avaliacoes = require('../repositories/avaliacaoRepository');
const { paraResposta } = require('./comentarioController');
const ID = /^[1-9]\d{0,8}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PAGE_SIZE = 20;
const MAX_ANCESTORS = 50;

async function context(req, res) {
  const { id, comentarioId } = req.params;
  const { apos, eventoId } = req.query ?? {};
  if (!ID.test(id) || !ID.test(comentarioId) ||
      (apos !== undefined && (typeof apos !== 'string' || !ID.test(apos))) ||
      (eventoId !== undefined && (typeof eventoId !== 'string' || !UUID.test(eventoId)))) {
    return res.status(400).json({ error: 'Contexto de comentário inválido' });
  }
  try {
    const review = await avaliacoes.findById(Number(id));
    const target = await comentarios.findById(Number(comentarioId));
    if (!review || !target || target.avaliacao_id !== review.id ||
        (eventoId && target.evento_id !== eventoId)) {
      return res.status(404).json({ error: 'Comentário não encontrado nesta avaliação' });
    }
    if (target.apagado_em) return res.status(410).json({ error: 'Este comentário foi removido' });
    if (apos !== undefined && Number(apos) < target.id) return res.status(400).json({ error: 'Página inválida' });
    const ancestors = [];
    const seen = new Set([target.id]);
    let parentId = target.pai_id;
    while (parentId !== null && ancestors.length < MAX_ANCESTORS) {
      if (seen.has(parentId)) return res.status(409).json({ error: 'Conversa com referência circular' });
      seen.add(parentId);
      const parent = await comentarios.findById(parentId);
      if (!parent || parent.avaliacao_id !== review.id) return res.status(404).json({ error: 'Contexto da conversa indisponível' });
      ancestors.unshift(parent);
      parentId = parent.pai_id;
    }
    if (parentId !== null && seen.has(parentId)) return res.status(409).json({ error: 'Conversa com referência circular' });
    const rows = await comentarios.findContextPage(review.id, apos === undefined ? target.id - 1 : Number(apos), PAGE_SIZE + 1);
    const page = rows.slice(0, PAGE_SIZE);
    return res.json({
      avaliacaoId: review.id, livroId: review.livro_id, comentarioId: target.id,
      alvo: (await paraResposta([target], req.user.id))[0],
      ancestrais: await paraResposta(ancestors, req.user.id),
      comentarios: await paraResposta(page, req.user.id),
      proximoCursor: rows.length > PAGE_SIZE ? page.at(-1).id : null,
      ancestralAnteriorId: parentId,
    });
  } catch (error) {
    console.error('Erro ao consultar contexto:', error.message);
    return res.status(500).json({ error: 'Não foi possível abrir a conversa' });
  }
}

module.exports = { context };
