const avaliacoes = require('../repositories/avaliacaoRepository');
const { mapWorkDetail } = require('../services/bookMapper');
const openLibrary = require('../services/openLibrary');

const ID_OBRA = /^OL\d+W$/;
const ID_AVALIACAO = /^\d{1,9}$/;
const RESENHA_MAXIMA = 5000;
const STATUS_POR_FALHA = { timeout: 504, unavailable: 502, invalid: 502, not_found: 404 };
const NAO_ENCONTRADA = 'Avaliação não encontrada';
const JA_AVALIOU = 'Você já avaliou este livro. Edite a avaliação existente.';

function lerConteudo(body) {
  const nota = body?.nota;
  if (!Number.isInteger(nota) || nota < 1 || nota > 5) {
    return { erro: 'A nota deve ser um número inteiro de 1 a 5' };
  }

  const resenha = body?.resenha ?? null;
  if (resenha !== null && typeof resenha !== 'string') {
    return { erro: 'A resenha deve ser um texto' };
  }

  const texto = resenha?.trim() ?? '';
  if (texto.length > RESENHA_MAXIMA) {
    return { erro: `A resenha deve ter no máximo ${RESENHA_MAXIMA} caracteres` };
  }

  return { nota, resenha: texto || null };
}

function paraResposta(avaliacao) {
  return {
    id: avaliacao.id,
    usuarioId: avaliacao.user_id,
    livro: {
      id: avaliacao.livro_id,
      titulo: avaliacao.livro_titulo,
      autores: avaliacao.livro_autores ?? [],
      capa: avaliacao.livro_capa ?? null,
    },
    nota: avaliacao.nota,
    resenha: avaliacao.resenha ?? null,
    criadoEm: new Date(avaliacao.criado_em).toISOString(),
    atualizadoEm: new Date(avaliacao.atualizado_em).toISOString(),
  };
}

function responderErro(res, error, contexto) {
  if (error instanceof openLibrary.OpenLibraryError) {
    return res.status(STATUS_POR_FALHA[error.kind] ?? 502).json({ error: error.message });
  }
  console.error(`${contexto}:`, error.message);
  return res.status(500).json({ error: 'Erro interno do servidor' });
}

async function buscarDaPessoa(req, res) {
  const id = ID_AVALIACAO.test(req.params?.id ?? '') ? Number(req.params.id) : null;
  if (id === null) {
    res.status(400).json({ error: 'Identificador de avaliação inválido' });
    return null;
  }

  const avaliacao = await avaliacoes.findById(id);
  if (!avaliacao) {
    res.status(404).json({ error: NAO_ENCONTRADA });
    return null;
  }

  if (avaliacao.user_id !== Number(req.user.id)) {
    res.status(403).json({ error: 'Você só pode alterar a sua própria avaliação' });
    return null;
  }

  return avaliacao;
}

const create = async (req, res) => {
  try {
    const livroId = typeof req.body?.livroId === 'string' ? req.body.livroId.trim() : '';
    if (!ID_OBRA.test(livroId)) {
      return res.status(400).json({ error: 'Identificador de livro inválido' });
    }

    const conteudo = lerConteudo(req.body);
    if (conteudo.erro) {
      return res.status(400).json({ error: conteudo.erro });
    }

    const existente = await avaliacoes.findByUserAndBook(req.user.id, livroId);
    if (existente) {
      return res.status(409).json({ error: JA_AVALIOU, avaliacaoId: existente.id });
    }

    const work = await openLibrary.getWork(livroId);
    const livro = mapWorkDetail(work, await openLibrary.getAuthorNames(work));
    if (!livro) {
      return res.status(404).json({ error: 'Livro não encontrado na Open Library.' });
    }

    const criada = await avaliacoes.create({
      userId: req.user.id,
      livro: { id: livro.id, titulo: livro.title, autores: livro.authors, capa: livro.coverUrl },
      nota: conteudo.nota,
      resenha: conteudo.resenha,
    });

    return res.status(201).json({ avaliacao: paraResposta(criada) });
  } catch (error) {
    if (error.code === 'DUPLICATE_REVIEW') {
      return res.status(409).json({ error: JA_AVALIOU });
    }
    return responderErro(res, error, 'Erro ao criar avaliação');
  }
};

const update = async (req, res) => {
  try {
    const avaliacao = await buscarDaPessoa(req, res);
    if (!avaliacao) return res;

    const conteudo = lerConteudo(req.body);
    if (conteudo.erro) {
      return res.status(400).json({ error: conteudo.erro });
    }

    const atualizada = await avaliacoes.update(avaliacao.id, req.user.id, conteudo);
    if (!atualizada) {
      return res.status(404).json({ error: NAO_ENCONTRADA });
    }

    return res.json({ avaliacao: paraResposta(atualizada) });
  } catch (error) {
    return responderErro(res, error, 'Erro ao editar avaliação');
  }
};

const remove = async (req, res) => {
  try {
    const avaliacao = await buscarDaPessoa(req, res);
    if (!avaliacao) return res;

    if (!(await avaliacoes.remove(avaliacao.id, req.user.id))) {
      return res.status(404).json({ error: NAO_ENCONTRADA });
    }

    return res.json({ message: 'Avaliação excluída!' });
  } catch (error) {
    return responderErro(res, error, 'Erro ao excluir avaliação');
  }
};

module.exports = { create, update, remove };
