const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createServices, session, json } = require('./helpers/services.cjs');
const comentario = (id, extra = {}) => ({ id, avaliacaoId: 2, paiId: null, autor: { id: 3, nome: 'Leitor' }, texto: 'Olá', removido: false, criadoEm: '2026-11-05T12:00:00Z', atualizadoEm: '2026-11-05T12:00:00Z', ...extra });
const payload = () => ({ avaliacaoId: 2, comentarioId: 4, livroId: 'OL1W', alvo: comentario(4), ancestrais: [], comentarios: [comentario(4)], proximoCursor: null, ancestralAnteriorId: null });

test('valida links e cria destino estável para notificação', () => {
  const h = createServices();
  for (const id of ['0', '-1', 'abc', ['4'], 1.5]) assert.throws(() => h.contexto.validarDestino(2, id));
  const eventoId = '00000000-0000-0000-0000-000000000001';
  const target = h.contexto.destinoDaNotificacao({ avaliacaoId: 2, comentarioId: 4, eventoId, alvoDisponivel: true });
  assert.equal(target.pathname, '/comentario/[id]');
  assert.equal(target.params.eventoId, eventoId);
  assert.throws(() => h.contexto.destinoDaNotificacao({ avaliacaoId: 2, comentarioId: 4, eventoId, alvoDisponivel: false }));
});

test('consulta autenticada preserva evento e cursor', async () => {
  const h = createServices(); await h.session.saveAuth(session);
  h.fetch = async () => json(payload());
  const eventoId = '00000000-0000-0000-0000-000000000001';
  await h.contexto.buscarContexto({ avaliacaoId: 2, comentarioId: 4, eventoId }, undefined, 5);
  assert.ok(h.requests[0].url.includes(`eventoId=${eventoId}&apos=5`));
  assert.equal(h.requests[0].headers.Authorization, `Bearer ${session.token}`);
});

test('não aceita outra avaliação, alvo divergente ou cursor que repete página', async () => {
  const h = createServices(); await h.session.saveAuth(session);
  for (const data of [
    { ...payload(), avaliacaoId: 8 }, { ...payload(), alvo: comentario(9) },
    { ...payload(), comentarios: [comentario(5, { avaliacaoId: 9 })] },
    { ...payload(), proximoCursor: 3 },
  ]) {
    h.fetch = async () => json(data);
    await assert.rejects(h.contexto.buscarContexto({ avaliacaoId: 2, comentarioId: 4 }), { kind: 'server' });
  }
});

test('remoção e expiração são propagadas e sessão expirada é removida', async () => {
  const h = createServices(); await h.session.saveAuth(session);
  h.fetch = async () => json({ error: 'Removido' }, 410);
  await assert.rejects(h.contexto.buscarContexto({ avaliacaoId: 2, comentarioId: 4 }), { status: 410 });
  h.fetch = async () => json({ error: 'Sessão expirada' }, 401);
  await assert.rejects(h.contexto.buscarContexto({ avaliacaoId: 2, comentarioId: 4 }), { status: 401 });
  assert.equal(await h.session.getAuth(), null);
});
