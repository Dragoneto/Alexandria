// Fixtures reutilizáveis das conversas. Pessoas e avaliações entram pelos repositórios (assim a avaliação não
// depende da Open Library); os comentários entram pela API real, com autenticação, rotas e validação de verdade.
// Carregue este módulo só depois de criar o ambiente: ele traz src/ junto.
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');

const jsonErrorHandler = require('../../src/middlewares/jsonErrorHandler');
const avaliacoesRepo = require('../../src/repositories/avaliacaoRepository');
const usersRepo = require('../../src/repositories/userRepository');
const avaliacaoRoutes = require('../../src/routes/avaliacoes');
const comentarioRoutes = require('../../src/routes/comentarios');
const { JWT_SECRET } = require('./ambiente');

const RESENHA = 'Leitura muito boa, recomendo.';

// server.js sobe a API ao ser carregado e leria o .env; aqui só as rotas das conversas, nos mesmos caminhos
function montarApi() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/avaliacoes', avaliacaoRoutes);
  app.use('/api/comentarios', comentarioRoutes);
  app.use(jsonErrorHandler);
  return app;
}

async function subirApi() {
  const servidor = await new Promise((resolve, reject) => {
    const aberto = montarApi().listen(0, '127.0.0.1', () => resolve(aberto));
    aberto.on('error', reject);
  });
  const baseUrl = `http://127.0.0.1:${servidor.address().port}`;

  return {
    async chamar(metodo, caminho, { leitor, corpo } = {}) {
      const resposta = await fetch(`${baseUrl}${caminho}`, {
        method: metodo,
        headers: {
          ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(leitor ? { Authorization: `Bearer ${leitor.token}` } : {}),
        },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
      });
      return { status: resposta.status, corpo: await resposta.json() };
    },
    encerrar: () => new Promise((resolve) => servidor.close(resolve)),
  };
}

function criarFixtures(api) {
  let sequencia = 0;
  const proximo = () => (sequencia += 1);

  async function novoLeitor(nome = 'Leitora') {
    const email = `${nome.toLowerCase()}-${proximo()}@alexandria.test`;
    const usuario = await usersRepo.create({ nome, email, senhaHash: 'hash-de-teste' });
    return { ...usuario, token: jwt.sign({ id: usuario.id, email }, JWT_SECRET, { expiresIn: '1h' }) };
  }

  function novaAvaliacao(leitor, { livroId = `OL${proximo()}W`, nota = 4 } = {}) {
    return avaliacoesRepo.create({
      userId: leitor.id,
      livro: { id: livroId, titulo: 'Quincas Borba', autores: ['Machado de Assis'], capa: null },
      nota,
      resenha: RESENHA,
    });
  }

  const listar = (leitor, avaliacaoId) => api.chamar('GET', `/api/avaliacoes/${avaliacaoId}/comentarios`, { leitor });
  const comentar = (leitor, avaliacaoId, texto, paiId) =>
    api.chamar('POST', `/api/avaliacoes/${avaliacaoId}/comentarios`, {
      leitor,
      corpo: paiId === undefined ? { texto } : { texto, paiId },
    });
  const editar = (leitor, id, corpo) => api.chamar('PUT', `/api/comentarios/${id}`, { leitor, corpo });
  const excluir = (leitor, id) => api.chamar('DELETE', `/api/comentarios/${id}`, { leitor });
  const excluirAvaliacao = (leitor, id) => api.chamar('DELETE', `/api/avaliacoes/${id}`, { leitor });

  /** Grava pela API e confere o 201: o cenário recebe direto o comentário. */
  async function comentado(leitor, avaliacaoId, texto, paiId) {
    const { status, corpo } = await comentar(leitor, avaliacaoId, texto, paiId);
    assert.equal(status, 201, `Comentário "${texto}" não foi criado: ${JSON.stringify(corpo)}`);
    return corpo.comentario;
  }

  /** A avaliação de Ana, comentada por Bia, respondida por Ana e respondida de novo por Bia: três níveis. */
  async function novaConversa() {
    const ana = await novoLeitor('Ana');
    const bia = await novoLeitor('Bia');
    const avaliacao = await novaAvaliacao(ana);
    const raiz = await comentado(bia, avaliacao.id, 'Comentário raiz da Bia');
    const resposta = await comentado(ana, avaliacao.id, 'Resposta da Ana', raiz.id);
    const neta = await comentado(bia, avaliacao.id, 'Resposta à resposta', resposta.id);
    return { ana, bia, avaliacao, raiz, resposta, neta };
  }

  return { novoLeitor, novaAvaliacao, listar, comentar, comentado, editar, excluir, excluirAvaliacao, novaConversa };
}

/** Tudo o que não pode existir no armazenamento, em qualquer modo e depois de qualquer cenário. */
function encontrarInconsistencias({ users, avaliacoes, comentarios }) {
  const idsDeUsuarios = new Set(users.map((u) => u.id));
  const idsDeAvaliacoes = new Set(avaliacoes.map((a) => a.id));
  const porId = new Map(comentarios.map((c) => [c.id, c]));

  const problemas = [];
  for (const a of avaliacoes) {
    if (!idsDeUsuarios.has(a.user_id)) problemas.push(`avaliação ${a.id} de usuário inexistente ${a.user_id}`);
  }
  for (const c of comentarios) {
    if (!idsDeUsuarios.has(c.user_id)) problemas.push(`comentário ${c.id} de usuário inexistente ${c.user_id}`);
    if (!idsDeAvaliacoes.has(c.avaliacao_id)) {
      problemas.push(`comentário ${c.id} órfão da avaliação ${c.avaliacao_id}`);
    }
    if (c.pai_id !== null) {
      const pai = porId.get(c.pai_id);
      if (!pai) problemas.push(`comentário ${c.id} órfão do pai ${c.pai_id}`);
      else if (pai.avaliacao_id !== c.avaliacao_id) problemas.push(`comentário ${c.id} com pai de outra avaliação`);
    }
    if ((c.texto === null) !== c.removido) problemas.push(`comentário ${c.id} com texto e marcador em desacordo`);
  }
  return problemas;
}

module.exports = { subirApi, criarFixtures, encontrarInconsistencias };
