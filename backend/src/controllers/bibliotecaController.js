const biblioteca = require('../repositories/bibliotecaRepository');
const { mapWorkDetail } = require('../services/bookMapper');
const openLibrary = require('../services/openLibrary');

const ID_OBRA = /^OL\d+W$/;
const ID_ITEM = /^\d{1,9}$/;
const STATUS_VALIDOS = ['QUERO_LER', 'LENDO', 'LIDO', 'ABANDONADO'];
const STATUS_POR_FALHA = { timeout: 504, unavailable: 502, invalid: 502, not_found: 404 };
const MAX_PAGINAS = 100000;

/** Data de hoje no fuso do Brasil (AAAA-MM-DD): é o "dia" do tracker de leitura. */
function hojeNoBrasil(agora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora);
}

function paginasValidas(valor, minimo) {
  return Number.isSafeInteger(valor) && valor >= minimo && valor <= MAX_PAGINAS;
}

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
    progresso: {
      paginaAtual: item.pagina_atual ?? 0,
      paginasTotal: item.paginas_total ?? null,
      diasLeitura: item.dias_leitura ?? 0,
      concluidoEm: item.concluido_em ? new Date(item.concluido_em).toISOString() : null,
    },
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
    const [work, paginasTotal] = await Promise.all([
      openLibrary.getWork(livroId),
      openLibrary.getPageCount(livroId),
    ]);
    const livro = mapWorkDetail(work, await openLibrary.getAuthorNames(work));
    if (!livro) {
      return res.status(404).json({ error: 'Livro não encontrado na Open Library.' });
    }

    const progresso = { paginasTotal };
    if (status === 'LENDO') {
      Object.assign(progresso, { diasLeitura: 1, ultimoDiaLeitura: hojeNoBrasil() });
    }
    if (status === 'LIDO') {
      Object.assign(progresso, {
        paginaAtual: paginasTotal ?? 0,
        concluidoEm: new Date().toISOString(),
      });
    }

    const criado = await biblioteca.create({
      userId: req.user.id,
      livro: { id: livro.id, titulo: livro.title, autores: livro.authors, capa: livro.coverUrl },
      status,
      progresso,
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

    const { status, favorito, paginaAtual, paginasTotal } = req.body ?? {};
    if ([status, favorito, paginaAtual, paginasTotal].every((campo) => campo === undefined)) {
      return res.status(400).json({ error: 'Informe status, favorito ou progresso' });
    }
    if (status !== undefined && !STATUS_VALIDOS.includes(status)) {
      return res.status(400).json({ error: 'Status de leitura inválido' });
    }
    if (favorito !== undefined && typeof favorito !== 'boolean') {
      return res.status(400).json({ error: 'Favorito deve ser verdadeiro ou falso' });
    }
    if (paginaAtual !== undefined && !paginasValidas(paginaAtual, 0)) {
      return res.status(400).json({ error: 'Página atual inválida' });
    }
    if (paginasTotal !== undefined && !paginasValidas(paginasTotal, 1)) {
      return res.status(400).json({ error: 'Número de páginas inválido' });
    }

    const id = Number(req.params.id);
    const atual = await biblioteca.findById(id, req.user.id);
    if (!atual) {
      return res.status(404).json({ error: 'Livro não encontrado na sua biblioteca.' });
    }

    const campos = { status, favorito, paginasTotal };
    let total = paginasTotal ?? atual.paginas_total ?? null;
    // Ao começar ou terminar a leitura, completa o número de páginas pela Open Library.
    if ((status === 'LENDO' || status === 'LIDO') && !total) {
      total = await openLibrary.getPageCount(atual.livro_id);
      if (total) campos.paginasTotal = total;
    }
    if (paginaAtual !== undefined) {
      if (total && paginaAtual > total) {
        return res.status(400).json({ error: `O livro tem ${total} páginas.` });
      }
      campos.paginaAtual = paginaAtual;
    }
    const mudouStatus = status !== undefined && status !== atual.status;
    if (mudouStatus && status === 'LIDO') {
      campos.concluidoEm = new Date().toISOString();
      if (total) campos.paginaAtual = total;
    } else if (mudouStatus && atual.status === 'LIDO') {
      campos.concluidoEm = null;
    }

    let item = await biblioteca.update(id, req.user.id, campos);
    if (!item) {
      return res.status(404).json({ error: 'Livro não encontrado na sua biblioteca.' });
    }
    // Começou a ler hoje: hoje já conta como um dia de leitura.
    if (mudouStatus && status === 'LENDO') {
      await biblioteca.registrarDiaDeLeitura(req.user.id, hojeNoBrasil(), id);
      item = (await biblioteca.findById(id, req.user.id)) ?? item;
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

/** O app chama ao abrir: cada dia com o app aberto soma 1 dia aos livros em "Lendo". */
const registrarDia = async (req, res) => {
  try {
    const contados = await biblioteca.registrarDiaDeLeitura(req.user.id, hojeNoBrasil());
    return res.json({ livrosAtualizados: contados });
  } catch (error) {
    console.error('Erro ao registrar dia de leitura:', error.message);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

module.exports = { list, add, update, remove, registrarDia, hojeNoBrasil };
