const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createServices, json, session } = require('./helpers/services.cjs');

async function logado() {
  const h = createServices();
  await h.session.saveAuth(session);
  return h;
}

test('publica a avaliação com o token da sessão', async () => {
  const h = await logado();
  const avaliacao = { id: 3, livro: { id: 'OL100W' }, nota: 5, resenha: 'Leitura muito boa.' };
  h.fetch = async (url, options) => {
    assert.equal(url, 'http://localhost:3000/api/avaliacoes');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, `Bearer ${session.token}`);
    assert.deepEqual(JSON.parse(options.body), { livroId: 'OL100W', nota: 5, resenha: 'Leitura muito boa.' });
    return json({ avaliacao }, 201);
  };
  assert.deepEqual(
    await h.avaliacoes.criarAvaliacao({ livroId: 'OL100W', nota: 5, resenha: 'Leitura muito boa.' }),
    avaliacao,
  );
});

test('repassa o 409 de quem já avaliou e a mensagem de validação do servidor', async () => {
  const h = await logado();
  h.fetch = async () => json({ error: 'Você já avaliou este livro.', avaliacaoId: 3 }, 409);
  await assert.rejects(h.avaliacoes.criarAvaliacao({ livroId: 'OL100W', nota: 5, resenha: 'x' }), { status: 409 });

  h.fetch = async () => json({ error: 'A nota é obrigatória', errors: { nota: 'A nota é obrigatória' } }, 400);
  await assert.rejects(h.avaliacoes.criarAvaliacao({ livroId: 'OL100W', nota: null, resenha: 'x' }), {
    kind: 'validation',
    message: 'A nota é obrigatória',
  });
});
