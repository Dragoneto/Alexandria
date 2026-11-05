const crypto = require('node:crypto');

const avaliacoes = require('../repositories/avaliacaoRepository');
const comentarios = require('../repositories/comentarioRepository');
const users = require('../repositories/userRepository');
const { buscarAvaliacao, limparResenha } = require('./avaliacaoController');

const ID_COMENTARIO = /^\d{1,9}$/;
// Gerada pelo app para cada mensagem e repetida quando ele tenta de novo (um UUID serve)
const IDEMPOTENCY_KEY = /^[\w-]{16,100}$/;
const TEXTO_MAXIMO = 2000;
const NAO_ENCONTRADO = 'Comentário não encontrado';
const REMOVIDO = 'Este comentário foi removido';
const MUDOU = 'Este comentário mudou desde que você abriu. Revise a versão atual antes de salvar de novo';
const VERSAO_INVALIDA = 'Versão do comentário inválida';

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
      versao: comentario.versao ?? 1, // no arquivo local, comentário sem o campo está na versão 1
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

// O repositório só altera comentário vivo e, na edição, na versão esperada. Se não gravou, ele sumiu com a
// avaliação (404), foi removido (409) ou mudou em outra sessão (409 com o atual, para revisar antes de tentar de novo)
async function responderNaoGravou(res, id, usuarioLogadoId) {
  const atual = await comentarios.findById(id);
  // No arquivo local o id pode ter passado para o comentário de outra pessoa: o desta sumiu com a avaliação
  if (atual?.user_id !== Number(usuarioLogadoId)) return res.status(404).json({ error: NAO_ENCONTRADO });
  if (atual.apagado_em) return res.status(409).json({ error: REMOVIDO });
  const [comentario] = await paraResposta([atual], usuarioLogadoId);
  return res.status(409).json({ error: MUDOU, errors: { versao: MUDOU }, comentario });
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

    const idempotencyKey = req.headers?.['idempotency-key'] ?? null;
    if (idempotencyKey !== null && !IDEMPOTENCY_KEY.test(idempotencyKey)) {
      return res.status(400).json({ error: 'Idempotency-Key inválida' });
    }

    // Sem paiId é comentário direto na avaliação; com paiId, resposta a um comentário desta avaliação
    const paiId = req.body?.paiId ?? null;
    if (paiId !== null && !(Number.isInteger(paiId) && paiId > 0 && paiId <= 999999999)) {
      return res.status(400).json({ error: 'Identificador de comentário inválido' });
    }

    // Reenvio de mensagem já gravada não confere o pai de novo: ele pode ter sido removido depois.
    // Antes de procurar, as keys com mais de 24 horas são esquecidas
    if (idempotencyKey) await comentarios.expireIdempotencyKeys();
    const anterior =
      idempotencyKey && (await comentarios.findByIdempotencyKey(req.user.id, idempotencyKey));
    if (paiId !== null && !anterior) {
      const pai = await comentarios.findById(paiId);
      if (pai?.avaliacao_id !== avaliacao.id) return res.status(404).json({ error: NAO_ENCONTRADO });
      if (pai.apagado_em) return res.status(409).json({ error: REMOVIDO });
    }

    const { texto, erro } = lerTexto(req.body?.texto);
    if (erro) return res.status(400).json({ error: erro, errors: { texto: erro } });

    // Mesma mensagem é mesma avaliação, mesmo pai e mesmo texto já limpo
    const payloadHash =
      idempotencyKey &&
      crypto.createHash('sha256').update(JSON.stringify([avaliacao.id, paiId, texto])).digest('hex');
    const destinatarios = [{ id: avaliacao.user_id, tipo: 'comentario' }];
    if (paiId !== null && !anterior) {
      const pai = await comentarios.findById(paiId);
      if (pai) destinatarios.push({ id: pai.user_id, tipo: 'resposta' });
    }
    const dados = { avaliacaoId: avaliacao.id, userId: req.user.id, paiId, texto, idempotencyKey, payloadHash, destinatarios };
    const criado = anterior || (await comentarios.create(dados));
    // No Postgres a chave estrangeira barra a gravação; no arquivo, quem desfaz é esta conferência
    if (!criado || !(await avaliacoes.findById(avaliacao.id))) {
      await comentarios.removeByAvaliacao(avaliacao.id);
      return res.status(404).json({ error: 'Avaliação não encontrada' });
    }
    if (idempotencyKey && criado.payload_hash !== payloadHash) {
      return res.status(409).json({ error: 'Idempotency-Key já usada em outra mensagem' });
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
    // A versão que a pessoa estava vendo: se o comentário mudou depois, a edição não sobrescreve
    const versao = req.body?.versao;
    if (!(Number.isInteger(versao) && versao > 0 && versao <= 999999999)) {
      return res.status(400).json({ error: VERSAO_INVALIDA, errors: { versao: VERSAO_INVALIDA } });
    }

    const editado = await comentarios.update(comentario.id, req.user.id, texto, versao);
    if (!editado) return responderNaoGravou(res, comentario.id, req.user.id);

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
    if (!removido) return responderNaoGravou(res, comentario.id, req.user.id);

    const [resposta] = await paraResposta([removido], req.user.id);
    return res.json({ comentario: resposta });
  } catch (error) {
    return responderErro(res, error, 'Erro ao excluir comentário');
  }
};

module.exports = { list, create, update, remove, paraResposta };
