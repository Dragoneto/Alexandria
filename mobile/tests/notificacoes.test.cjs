const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createServices, session, json } = require('./helpers/services.cjs');
const id = '00000000-0000-0000-0000-000000000001';
const event = '00000000-0000-0000-0000-000000000002';
const item = {
  id,
  tipo: 'resposta',
  autor: { id: 2, nome: 'Leitora' },
  avaliacaoId: 8,
  comentarioId: 9,
  eventoId: event,
  criadoEm: '2026-11-05T12:00:00.000Z',
  lidaEm: null,
  alvoDisponivel: true,
};

test('lista notificações validando contrato e usa o cliente HTTP autenticado', async () => {
  const h = createServices();
  await h.session.saveAuth(session);
  h.fetch = async () => json({ notificacoes: [item], proximoCursor: 'cursor-opaco' });
  const page = await h.notificacoes.listarNotificacoes();
  assert.equal(page.notificacoes[0].autor.nome, 'Leitora');
  assert.equal(page.proximoCursor, 'cursor-opaco');
  assert.equal(h.requests[0].headers.Authorization, `Bearer ${session.token}`);
  assert.match(h.requests[0].url, /limit=20/);
});

test('paginação, contador e leitura usam os métodos e rotas esperados', async () => {
  const h = createServices();
  await h.session.saveAuth(session);
  h.fetch = async () => json({ notificacoes: [], proximoCursor: null });
  await h.notificacoes.listarNotificacoes('opaque');
  h.fetch = async () => json({ total: 3 });
  assert.equal(await h.notificacoes.contarNaoLidas(), 3);
  h.fetch = async () => json({ atualizadas: 1 });
  await h.notificacoes.marcarNotificacaoLida(id);
  await h.notificacoes.marcarTodasNotificacoesLidas();
  assert.match(h.requests[0].url, /cursor=opaque/);
  assert.equal(h.requests[2].method, 'PATCH');
  assert.ok(h.requests[2].url.endsWith(`/api/notificacoes/${id}/lida`));
  assert.ok(h.requests[3].url.endsWith('/api/notificacoes/lidas'));
});

test('recusa item malformado, contador inválido e id de leitura incorreto', async () => {
  const h = createServices();
  await h.session.saveAuth(session);
  h.fetch = async () => json({ notificacoes: [{ ...item, autor: {} }], proximoCursor: null });
  await assert.rejects(h.notificacoes.listarNotificacoes(), { kind: 'server' });
  h.fetch = async () => json({ total: -1 });
  await assert.rejects(h.notificacoes.contarNaoLidas(), { kind: 'server' });
  await assert.rejects(h.notificacoes.marcarNotificacaoLida('invalid'), { kind: 'validation' });
});

test('alvo indisponível não cria destino e chave idempotente permite toque rápido', async () => {
  const h = createServices();
  assert.throws(
    () => h.notificacoes.destinoDaNotificacaoRecebida({ ...item, alvoDisponivel: false }),
    { kind: 'validation' },
  );
  await h.session.saveAuth(session);
  h.fetch = async () => json({ atualizadas: 1 });
  await Promise.all([
    h.notificacoes.marcarNotificacaoLida(id),
    h.notificacoes.marcarNotificacaoLida(id),
  ]);
  assert.equal(h.requests.length, 2);
});

test('401 limpa a sessão e propaga erro para a interface', async () => {
  const h = createServices();
  await h.session.saveAuth(session);
  h.fetch = async () => json({ error: 'Sessão expirada' }, 401);
  await assert.rejects(h.notificacoes.contarNaoLidas(), { status: 401 });
  assert.equal(await h.session.getAuth(), null);
});
