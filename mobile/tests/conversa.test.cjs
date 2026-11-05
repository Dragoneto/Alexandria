const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createServices } = require('./helpers/services.cjs');

const { comentarios, api } = createServices();

function comentario(id, paiId, extra = {}) {
  return {
    id,
    avaliacaoId: 3,
    paiId,
    autor: { id: id * 10, nome: `Pessoa ${id}` },
    texto: `texto ${id}`,
    removido: false,
    criadoEm: '2026-11-05T10:00:00.000Z',
    atualizadoEm: '2026-11-05T10:00:00.000Z',
    podeEditar: false,
    podeExcluir: false,
    ...extra,
  };
}

const resumo = (itens) => itens.map((item) => [item.comentario.id, item.nivel, item.respondendoA]);

test('cada resposta aparece logo abaixo do pai, com o nível e para quem responde', () => {
  const lista = [comentario(1, null), comentario(2, null), comentario(3, 1), comentario(4, 3)];

  assert.deepEqual(resumo(comentarios.montarConversa(lista)), [
    [1, 0, null],
    [3, 1, 'Pessoa 1'],
    [4, 2, 'Pessoa 3'],
    [2, 0, null],
  ]);
});

test('comentário removido continua na conversa e mantém as respostas', () => {
  const lista = [comentario(1, null, { removido: true, texto: null }), comentario(2, 1)];

  assert.deepEqual(resumo(comentarios.montarConversa(lista)), [
    [1, 0, null],
    [2, 1, 'comentário removido'],
  ]);
});

test('resposta sem o pai na lista vira comentário principal e nada se repete', () => {
  const lista = [comentario(5, 99), comentario(6, 6), comentario(7, 5)];
  const itens = comentarios.montarConversa(lista);

  assert.deepEqual(resumo(itens), [
    [5, 0, null],
    [7, 1, 'Pessoa 5'],
    [6, 0, null],
  ]);
  assert.equal(new Set(itens.map((item) => item.comentario.id)).size, lista.length);
});

test('o recuo visual para no nível máximo, mas o nível real é mantido', () => {
  const lista = [comentario(1, null)];
  for (let id = 2; id <= 7; id += 1) lista.push(comentario(id, id - 1));
  const ultimo = comentarios.montarConversa(lista).at(-1);

  assert.equal(ultimo.nivel, 6);
  assert.equal(ultimo.respondendoA, 'Pessoa 6');
  assert.equal(comentarios.recuoVisual(ultimo.nivel), comentarios.NIVEL_VISUAL_MAXIMO);
  assert.equal(comentarios.recuoVisual(1), 1);
});

test('mensagens de falha dizem o que aconteceu sem perder o texto', () => {
  const { ApiError } = api;
  const msg = comentarios.mensagemDeFalhaComentario;

  assert.match(msg(new ApiError('network', 'x')), /Seu texto continua aqui/);
  assert.match(msg(new ApiError('server', 'x', 409)), /foi removido/);
  assert.match(msg(new ApiError('server', 'x', 403)), /seus próprios comentários/);
  assert.equal(msg(new ApiError('validation', 'O comentário é obrigatório', 400)), 'O comentário é obrigatório');
  assert.match(msg(new Error('qualquer')), /Tente de novo/);
});
