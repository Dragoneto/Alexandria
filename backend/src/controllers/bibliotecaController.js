const biblioteca = require('../repositories/bibliotecaRepository');
const { mapWorkDetail } = require('../services/bookMapper');
const openLibrary = require('../services/openLibrary');

const ID_OBRA = /^OL\d+W$/;
const ID_ITEM = /^\d{1,9}$/;
const STATUS_VALIDOS = ['QUERO_LER', 'LENDO', 'LIDO', 'ABANDONADO'];
const STATUS_POR_FALHA = { timeout: 504, unavailable: 502, invalid: 502, not_found: 404 };

function paraResposta(item) {
  return {
    id: item.id,
    statusLeitura: item.status,
    favorito: item.favorito,
    livro: {
      id: item.livro_id,
      titulo: item.livro_titulo,
      autores: item.livro_autores ?? [],
      capa: item.livro_capa ?? null,
    },
    adicionadoEm: new Date(item.adicionado_em).toISOString(),
  };
}

const list = async (req, res) => {
  try {
    const status = typeof req.query?.status === 'string' ? req.query.status.trim() : '';
    if (status && !STATUS_VALIDOS.includes(status)) {
      return res.status(400).json({ error: 'Status de leitura inválido' });
    }

    const itens = await biblioteca.findByUser(req.user.id, status || undefined);
    return res.json({ itens: itens.map(paraResposta) });
  } catch (error) {
    console.error('Erro ao listar biblioteca:', error.message);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const add = async (req, res) => {
  try {
    const livroId = typeof req.body?.livroId === 'string' ? req.body.livroId.trim() : '';
    if (!ID_OBRA.test(livroId)) {
      return res.status(400).json({ error: 'Identificador de livro inválido' });
    }

    const status = req.body?.status ?? 'QUERO_LER';
    if (!STATUS_VALIDOS.includes(status)) {
      return res.status(400).json({ error: 'Status de leitura inválido' });
    }

    // Busca os dados na Open Library em vez de confiar no que o app mandou
    const work = await openLibrary.getWork(livroId);
    const livro = mapWorkDetail(work, await openLibrary.getAuthorNames(work));
    if (!livro) {
      return res.status(404).json({ error: 'Livro não encontrado na Open Library.' });
    }

    const criado = await biblioteca.create({
      userId: req.user.id,
      livro: { id: livro.id, titulo: livro.title, autores: livro.authors, capa: livro.coverUrl },
      status,
    });
    return res.status(201).json({ item: paraResposta(criado) });
  } catch (error) {
    if (error.code === 'DUPLICATE_LIBRARY_ITEM') {
      return res.status(409).json({ error: 'Este livro já está na sua biblioteca.' });
    }
    if (error instanceof openLibrary.OpenLibraryError) {
      return res.status(STATUS_POR_FALHA[error.kind] ?? 502).json({ error: error.message });
    }
    console.error('Erro ao adicionar à biblioteca:', error.message);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const update = async (req, res) => {
  try {
    if (!ID_ITEM.test(req.params?.id ?? '')) {
      return res.status(400).json({ error: 'Identificador inválido' });
    }

    const { status, favorito } = req.body ?? {};
    if (status === undefined && favorito === undefined) {
      return res.status(400).json({ error: 'Informe status ou favorito' });
    }
    if (status !== undefined && !STATUS_VALIDOS.includes(status)) {
      return res.status(400).json({ error: 'Status de leitura inválido' });
    }
    if (favorito !== undefined && typeof favorito !== 'boolean') {
      return res.status(400).json({ error: 'Favorito deve ser verdadeiro ou falso' });
    }

    const item = await biblioteca.update(Number(req.params.id), req.user.id, { status, favorito });
    if (!item) {
      return res.status(404).json({ error: 'Livro não encontrado na sua biblioteca.' });
    }
    return res.json({ item: paraResposta(item) });
  } catch (error) {
    console.error('Erro ao atualizar biblioteca:', error.message);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const remove = async (req, res) => {
  try {
    if (!ID_ITEM.test(req.params?.id ?? '')) {
      return res.status(400).json({ error: 'Identificador inválido' });
    }

    const removido = await biblioteca.remove(Number(req.params.id), req.user.id);
    if (!removido) {
      return res.status(404).json({ error: 'Livro não encontrado na sua biblioteca.' });
    }

    return res.json({ message: 'Livro removido da biblioteca!' });
  } catch (error) {
    console.error('Erro ao remover da biblioteca:', error.message);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};


module.exports = { list, add, update, remove };
