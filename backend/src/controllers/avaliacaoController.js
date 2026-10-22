const avaliacoes = require('../repositories/avaliacaoRepository');
const { mapWorkDetail } = require('../services/bookMapper');
const openLibrary = require('../services/openLibrary');
const users = require('../repositories/userRepository');

const ID_OBRA = /^OL\d+W$/;
const ID_AVALIACAO = /^\d{1,9}$/;
const RESENHA_MINIMA = 10;
const RESENHA_MAXIMA = 5000;
const LIMITE_PADRAO = 10;
const LIMITE_MAXIMO = 20;
const STATUS_POR_FALHA = { timeout: 504, unavailable: 502, invalid: 502, not_found: 404 };
const NAO_ENCONTRADA = 'Avaliação não encontrada';
const JA_AVALIOU = 'Você já avaliou este livro. Edite a avaliação existente.';

function erroDaNota(nota) {
  if (nota === undefined || nota === null) return 'A nota é obrigatória';
  if (!Number.isInteger(nota) || nota < 1 || nota > 5) {
    return 'A nota deve ser um número inteiro de 1 a 5';
  }
  return null;
}

function limparResenha(texto) {
  return texto
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(/[\p{Cc}\p{Cf}]/gu, (c) => (c === '\n' || c === '\t' || c === '‍' ? c : ''))
    .replace(/‍(?!\p{Extended_Pictographic})/gu, '')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function erroDaResenha(resenha) {
  if (resenha !== undefined && resenha !== null && typeof resenha !== 'string') {
    return 'A resenha deve ser um texto';
  }

  const texto = resenha ?? '';
  const tamanho = [...texto].length;
  if (!tamanho) return 'A resenha é obrigatória';
  if (tamanho < RESENHA_MINIMA) return `A resenha deve ter pelo menos ${RESENHA_MINIMA} caracteres`;
  if (tamanho > RESENHA_MAXIMA) return `A resenha deve ter no máximo ${RESENHA_MAXIMA} caracteres`;
  if (!/\p{L}|\p{Extended_Pictographic}/u.test(texto)) {
    return 'A resenha precisa ter palavras ou emoji, não só números ou símbolos';
  }
  if (new Set(texto.replace(/\s/g, '')).size === 1) {
    return 'A resenha não pode ser só um caractere repetido';
  }
  return null;
}

function lerConteudo(body) {
  const erros = {};
  const resenha = typeof body?.resenha === 'string' ? limparResenha(body.resenha) : body?.resenha;
  const erroNota = erroDaNota(body?.nota);
  const erroResenha = erroDaResenha(resenha);
  if (erroNota) erros.nota = erroNota;
  if (erroResenha) erros.resenha = erroResenha;
  if (Object.keys(erros).length) return { erros };
  return { nota: body.nota, resenha };
}

function responderJaAvaliou(res, avaliacao) {
  return res.status(409).json({ error: JA_AVALIOU, avaliacaoId: avaliacao?.id });
}

function responderInvalido(res, erros) {
  return res.status(400).json({ error: Object.values(erros)[0], errors: erros });
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

// Mesma regra de page e limit da busca de livros (positiveIntParam no bookController)
function inteiroPositivo(valor, padrao) {
  if (valor === undefined) return padrao;
  const numero = typeof valor === 'string' && /^\d{1,6}$/.test(valor.trim()) ? Number(valor) : 0;
  return numero > 0 ? numero : null;
}

// Nome de quem avaliou (nunca e-mail nem foto) e se a avaliação é de quem está logado
async function paraLeituras(lista, usuarioLogadoId) {
  if (!lista.length) return [];
  const pessoas = await users.findNames([...new Set(lista.map((a) => a.user_id))]);
  const nomes = new Map(pessoas.map((pessoa) => [pessoa.id, pessoa.nome]));
  return lista.map((avaliacao) => ({
    ...paraResposta(avaliacao),
    usuarioNome: nomes.get(avaliacao.user_id) ?? null,
    minha: avaliacao.user_id === Number(usuarioLogadoId),
  }));
}

function responderErro(res, error, contexto) {
  if (error instanceof openLibrary.OpenLibraryError) {
    return res.status(STATUS_POR_FALHA[error.kind] ?? 502).json({ error: error.message });
  }
  console.error(`${contexto}:`, error.message);
  return res.status(500).json({ error: 'Erro interno do servidor' });
}

async function buscarAvaliacao(req, res) {
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

  return avaliacao;
}

async function buscarDaPessoa(req, res) {
  const avaliacao = await buscarAvaliacao(req, res);
  if (avaliacao && avaliacao.user_id !== Number(req.user.id)) {
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

    const existente = await avaliacoes.findByUserAndBook(req.user.id, livroId);
    if (existente) return responderJaAvaliou(res, existente);

    const conteudo = lerConteudo(req.body);
    if (conteudo.erros) return responderInvalido(res, conteudo.erros);

    const work = await openLibrary.getWork(livroId);
    const [autores, unificados] = await Promise.all([
      openLibrary.getAuthorNames(work),
      openLibrary.getMergedWorkIds(work).catch(() => []), // checagem extra: se falhar, segue sem ela
    ]);
    const livro = mapWorkDetail(work, autores);
    if (!livro) {
      return res.status(404).json({ error: 'Livro não encontrado na Open Library.' });
    }

    // O livro pode ter sido unificado na Open Library depois que a pessoa avaliou por outro id
    const ids = new Set([livro.id, ...unificados]);
    const jaAvaliada = (await avaliacoes.findByUser(req.user.id)).find((a) => ids.has(a.livro_id));
    if (jaAvaliada) return responderJaAvaliou(res, jaAvaliada);

    const criada = await avaliacoes.create({
      userId: req.user.id,
      livro: { id: livro.id, titulo: livro.title, autores: livro.authors, capa: livro.coverUrl },
      nota: conteudo.nota,
      resenha: conteudo.resenha,
    }).catch((error) => {
      if (error.code === 'DUPLICATE_REVIEW') return null; // toque duplo: o outro pedido gravou primeiro
      throw error;
    });
    if (!criada) return responderJaAvaliou(res, await avaliacoes.findByUserAndBook(req.user.id, livro.id));

    return res.status(201).json({ avaliacao: paraResposta(criada) });
  } catch (error) {
    return responderErro(res, error, 'Erro ao criar avaliação');
  }
};

const update = async (req, res) => {
  try {
    const avaliacao = await buscarDaPessoa(req, res);
    if (!avaliacao) return res;

    const conteudo = lerConteudo(req.body);
    if (conteudo.erros) return responderInvalido(res, conteudo.erros);

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

const listByBook = async (req, res) => {
  try {
    const livroId = typeof req.params?.livroId === 'string' ? req.params.livroId.trim() : '';
    if (!ID_OBRA.test(livroId)) {
      return res.status(400).json({ error: 'Identificador de livro inválido' });
    }

    const page = inteiroPositivo(req.query?.page, 1);
    const limitePedido = inteiroPositivo(req.query?.limit, LIMITE_PADRAO);
    if (!page || !limitePedido) {
      return res.status(400).json({ error: 'Página e tamanho devem ser números inteiros positivos' });
    }
    const limit = Math.min(limitePedido, LIMITE_MAXIMO);

    const consulta = { usuarioId: req.user.id, limit, offset: (page - 1) * limit };
    const { avaliacoes: pagina, total, soma } = await avaliacoes.findByBook(livroId, consulta);

    const media = total ? Math.round((soma * 10) / total) / 10 : null;
    const lidas = await paraLeituras(pagina, req.user.id);
    return res.json({ avaliacoes: lidas, total, media, page, limit, hasMore: page * limit < total });
  } catch (error) {
    return responderErro(res, error, 'Erro ao listar avaliações do livro');
  }
};

const listMine = async (req, res) => {
  try {
    const lista = await avaliacoes.findByUser(req.user.id);
    return res.json({ avaliacoes: await paraLeituras(lista, req.user.id) });
  } catch (error) {
    return responderErro(res, error, 'Erro ao listar suas avaliações');
  }
};

const detail = async (req, res) => {
  try {
    const avaliacao = await buscarAvaliacao(req, res);
    if (!avaliacao) return res;

    const [lida] = await paraLeituras([avaliacao], req.user.id);
    return res.json({ avaliacao: lida });
  } catch (error) {
    return responderErro(res, error, 'Erro ao buscar avaliação');
  }
};

module.exports = { create, update, remove, listByBook, listMine, detail };
