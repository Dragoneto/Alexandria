const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createServices, json, session } = require('./helpers/services.cjs');

const COMENTARIO = {
  id: 7,
  avaliacaoId: 3,
  paiId: null,
  autor: { id: 2, nome: 'Bruno' },
  texto: 'Também gostei.',
  removido: false,
  criadoEm: '2026-11-04T10:00:00.000Z',
  atualizadoEm: '2026-11-04T10:00:00.000Z',
  podeEditar: true,
  podeExcluir: true,
};
const REMOVIDO = { ...COMENTARIO, id: 8, texto: null, removido: true };
const RESPOSTA = { ...COMENTARIO, id: 9, paiId: 8, podeEditar: false, podeExcluir: false };

async function logado() {
  const h = createServices();
  await h.session.saveAuth(session);
  return h;
}

test('lista com o token da sessão e mantém a resposta de um comentário removido', async () => {
  const h = await logado();
  h.fetch = async (url, options) => {
    assert.equal(url, 'http://localhost:3000/api/avaliacoes/3/comentarios');
    assert.equal(options.method, 'GET');
    assert.equal(options.headers.Authorization, `Bearer ${session.token}`);
    return json({ comentarios: [COMENTARIO, REMOVIDO, RESPOSTA] });
  };

  const lista = await h.comentarios.listarComentarios(3);

  assert.equal(lista.length, 3);
  assert.equal(lista[1].removido, true);
  assert.equal(lista[1].texto, null);
  assert.equal(lista[2].paiId, lista[1].id);
  assert.equal(lista[2].texto, 'Também gostei.');
});

test('comentário removido nunca expõe texto nem permite editar ou excluir', async () => {
  const h = await logado();
  h.fetch = async () =>
    json({ comentarios: [{ ...REMOVIDO, texto: 'vazou', podeEditar: true, podeExcluir: true }] });

  const [removido] = await h.comentarios.listarComentarios(3);

  assert.equal(removido.texto, null);
  assert.equal(removido.podeEditar, false);
  assert.equal(removido.podeExcluir, false);
});

test('comentar e responder enviam o payload certo', async () => {
  const h = await logado();
  const corpos = [];
  h.fetch = async (url, options) => {
    assert.equal(url, 'http://localhost:3000/api/avaliacoes/3/comentarios');
    assert.equal(options.method, 'POST');
    corpos.push(JSON.parse(options.body));
    return json({ comentario: COMENTARIO }, 201);
  };

  assert.equal((await h.comentarios.comentar(3, 'Oi')).id, 7);
  await h.comentarios.responder(3, 7, 'Olá');

  assert.deepEqual(corpos, [{ texto: 'Oi' }, { texto: 'Olá', paiId: 7 }]);
});

test('editar e excluir usam a rota do comentário', async () => {
  const h = await logado();
  const chamadas = [];
  h.fetch = async (url, options) => {
    chamadas.push([options.method, url, options.body]);
    return json({ comentario: options.method === 'DELETE' ? REMOVIDO : COMENTARIO });
  };

  await h.comentarios.editarComentario(7, 'Novo texto');
  assert.equal((await h.comentarios.excluirComentario(8)).removido, true);

  assert.deepEqual(chamadas, [
    ['PUT', 'http://localhost:3000/api/comentarios/7', JSON.stringify({ texto: 'Novo texto' })],
    ['DELETE', 'http://localhost:3000/api/comentarios/8', undefined],
  ]);
});

test('resposta fora do contrato vira erro do servidor', async () => {
  const h = await logado();
  const invalidos = [{}, { comentarios: 'x' }, { comentarios: [{ id: 1 }] }];
  invalidos.push({ comentarios: [{ ...COMENTARIO, texto: null }] });

  for (const corpo of invalidos) {
    h.fetch = async () => json(corpo);
    await assert.rejects(h.comentarios.listarComentarios(3), { kind: 'server' });
  }
});

test('distingue validação, sessão, permissão, removido, rede e servidor', async () => {
  const h = await logado();
  const casos = [
    [400, 'validacao'],
    [403, 'permissao'],
    [404, 'removido'],
    [409, 'removido'],
    [500, 'servidor'],
    [401, 'sessao'],
  ];

  for (const [status, esperado] of casos) {
    h.fetch = async () => json({ error: 'Falhou', errors: { texto: 'Falhou' } }, status);
    const falha = await h.comentarios.comentar(3, 'Oi').catch((erro) => erro);
    assert.equal(h.comentarios.classificarFalhaComentario(falha), esperado, String(status));
  }

  await h.session.saveAuth(session);
  h.fetch = async () => {
    throw new TypeError('Network request failed');
  };
  const semRede = await h.comentarios.comentar(3, 'Oi').catch((erro) => erro);
  assert.equal(h.comentarios.classificarFalhaComentario(semRede), 'rede');
  assert.equal(await h.session.getAuth().then((atual) => atual?.token), session.token);
});

test('sessão expirada derruba a sessão salva, como nas outras rotas', async () => {
  const h = await logado();
  h.fetch = async () => json({ error: 'Token inválido ou expirado' }, 401);

  await assert.rejects(h.comentarios.listarComentarios(3), { kind: 'auth', status: 401 });
  assert.equal(await h.session.getAuth(), null);
});
