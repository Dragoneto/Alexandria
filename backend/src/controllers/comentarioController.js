const avaliacoes = require('../repositories/avaliacaoRepository');
const comentarios = require('../repositories/comentarioRepository');
const users = require('../repositories/userRepository');
const { buscarAvaliacao, limparResenha } = require('./avaliacaoController');

const ID_COMENTARIO = /^\d{1,9}$/;
const TEXTO_MAXIMO = 2000;
const NAO_ENCONTRADO = 'Comentário não encontrado';
const REMOVIDO = 'Este comentário foi removido';

// Mesma limpeza da resenha: texto só com espaços ou caracteres invisíveis conta como vazio
function lerTexto(valor) {
  if (valor != null && typeof valor !== 'string') return { erro: 'O comentário deve ser um texto' };
  const texto = limparResenha(valor ?? '');
  if (!texto) return { erro: 'O comentário é obrigatório' };
  if ([...texto].length > TEXTO_MAXIMO) {
    return { erro: `O comentário deve ter no máximo ${TEXTO_MAXIMO} caracteres` };
  }
  return { texto };
}

// Formato do serviço de comentários do app (#167): do autor vão só id e nome, nunca e-mail nem foto
async function paraResposta(lista, usuarioLogadoId) {
  if (!lista.length) return [];
  const pessoas = await users.findNames([...new Set(lista.map((c) => c.user_id))]);
  const nomes = new Map(pessoas.map((pessoa) => [pessoa.id, pessoa.nome]));
  return lista.map((comentario) => {
    const removido = Boolean(comentario.apagado_em);
    const meu = !removido && comentario.user_id === Number(usuarioLogadoId);
    return {
      id: comentario.id,
      avaliacaoId: comentario.avaliacao_id,
      paiId: comentario.pai_id,
      autor: { id: comentario.user_id, nome: nomes.get(comentario.user_id) ?? '' },
      texto: comentario.texto,
      removido,
      criadoEm: new Date(comentario.criado_em).toISOString(),
      atualizadoEm: new Date(comentario.atualizado_em).toISOString(),
      podeEditar: meu,
      podeExcluir: meu,
    };
  });
}

function responderErro(res, error, contexto) {
  console.error(`${contexto}:`, error.message);
  return res.status(500).json({ error: 'Erro interno do servidor' });
}

// 404 se não existe e 403 se é de outra pessoa; comentário removido não grava e cai no responderNaoGravou
async function buscarDoAutor(req, res) {
  const id = ID_COMENTARIO.test(req.params?.id ?? '') ? Number(req.params.id) : null;
  if (id === null) {
    res.status(400).json({ error: 'Identificador de comentário inválido' });
    return null;
  }

  const comentario = await comentarios.findById(id);
  if (!comentario) {
    res.status(404).json({ error: NAO_ENCONTRADO });
    return null;
  }
  if (comentario.user_id !== Number(req.user.id)) {
    res.status(403).json({ error: 'Você só pode alterar o seu próprio comentário' });
    return null;
  }

  return comentario;
}

// O repositório só altera comentário vivo: se não gravou, ele está removido (409) ou sumiu com a avaliação (404)
async function responderNaoGravou(res, id) {
  return (await comentarios.findById(id))
    ? res.status(409).json({ error: REMOVIDO })
    : res.status(404).json({ error: NAO_ENCONTRADO });
}

const list = async (req, res) => {
  try {
    const avaliacao = await buscarAvaliacao(req, res);
    if (!avaliacao) return res;

    const lista = await comentarios.findByAvaliacao(avaliacao.id);
    return res.json({ comentarios: await paraResposta(lista, req.user.id) });
  } catch (error) {
    return responderErro(res, error, 'Erro ao listar comentários');
  }
};

const create = async (req, res) => {
  try {
    const avaliacao = await buscarAvaliacao(req, res);
    if (!avaliacao) return res;

    // Sem paiId é comentário direto na avaliação; com paiId, resposta a um comentário desta avaliação
    const paiId = req.body?.paiId ?? null;
    if (paiId !== null && !(Number.isInteger(paiId) && paiId > 0 && paiId <= 999999999)) {
      return res.status(400).json({ error: 'Identificador de comentário inválido' });
    }
    if (paiId !== null) {
      const pai = await comentarios.findById(paiId);
      if (pai?.avaliacao_id !== avaliacao.id) return res.status(404).json({ error: NAO_ENCONTRADO });
      if (pai.apagado_em) return res.status(409).json({ error: REMOVIDO });
    }

    const { texto, erro } = lerTexto(req.body?.texto);
    if (erro) return res.status(400).json({ error: erro, errors: { texto: erro } });

    const criado = await comentarios.create({ avaliacaoId: avaliacao.id, userId: req.user.id, paiId, texto });
    // No Postgres a chave estrangeira barra a gravação; no arquivo, quem desfaz é esta conferência
    if (!criado || !(await avaliacoes.findById(avaliacao.id))) {
      await comentarios.removeByAvaliacao(avaliacao.id);
      return res.status(404).json({ error: 'Avaliação não encontrada' });
    }

    const [comentario] = await paraResposta([criado], req.user.id);
    return res.status(201).json({ comentario });
  } catch (error) {
    return responderErro(res, error, 'Erro ao comentar');
  }
};

const update = async (req, res) => {
  try {
    const comentario = await buscarDoAutor(req, res);
    if (!comentario) return res;

    const { texto, erro } = lerTexto(req.body?.texto);
    if (erro) return res.status(400).json({ error: erro, errors: { texto: erro } });

    const editado = await comentarios.update(comentario.id, req.user.id, texto);
    if (!editado) return responderNaoGravou(res, comentario.id);

    const [resposta] = await paraResposta([editado], req.user.id);
    return res.json({ comentario: resposta });
  } catch (error) {
    return responderErro(res, error, 'Erro ao editar comentário');
  }
};

const remove = async (req, res) => {
  try {
    const comentario = await buscarDoAutor(req, res);
    if (!comentario) return res;

    const removido = await comentarios.remove(comentario.id, req.user.id);
    if (!removido) return responderNaoGravou(res, comentario.id);

    const [resposta] = await paraResposta([removido], req.user.id);
    return res.json({ comentario: resposta });
  } catch (error) {
    return responderErro(res, error, 'Erro ao excluir comentário');
  }
};

module.exports = { list, create, update, remove };
