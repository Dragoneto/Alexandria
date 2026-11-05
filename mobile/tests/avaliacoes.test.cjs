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

test('valida nota e resenha com as mesmas regras do servidor, antes de enviar', () => {
  const { validarAvaliacao } = createServices().avaliacoes;
  const RESENHA = 'Leitura muito boa.';

  assert.deepEqual(validarAvaliacao(4, RESENHA), {});
  assert.deepEqual(validarAvaliacao(5, '📚😍👏🔥✨🙌💯👍🤩📖'), {});
  assert.match(validarAvaliacao(null, RESENHA).nota, /Escolha uma nota/);

  const casos = [
    ['   ', /Escreva uma resenha/],
    ['Gostei.', /pelo menos 10/],
    ['a          b', /pelo menos 10/],
    [`a${'​'.repeat(10)}`, /pelo menos 10/],
    ['Bom 👨‍👩‍👧', /pelo menos 10/],
    ['1234567890', /palavras ou emoji/],
    ['kkkkkkkkkkkk', /caractere repetido/],
    ['a'.repeat(5001), /no máximo 5000/],
  ];
  for (const [resenha, mensagem] of casos) {
    assert.match(validarAvaliacao(4, resenha).resenha ?? '', mensagem, JSON.stringify(resenha));
  }
});

test('conta os caracteres como o servidor: emoji composto vale um por símbolo', () => {
  const { contarCaracteres } = createServices().avaliacoes;

  assert.equal(contarCaracteres('  Muito   bom  '), 9);
  assert.equal(contarCaracteres('Bom 👨‍👩‍👧'), 9);
  assert.equal(contarCaracteres('ação'.normalize('NFD')), 4);
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

test('lista as avaliações do livro com total, média e página', async () => {
  const h = await logado();
  const minha = { id: 9, minha: true, usuarioNome: 'Davi', nota: 4, resenha: 'Gostei bastante.' };
  const outra = { id: 5, minha: false, usuarioNome: 'Ana', nota: 5, resenha: 'Excelente leitura.' };
  h.fetch = async (url, options) => {
    assert.equal(url, 'http://localhost:3000/api/avaliacoes/livro/OL100W?page=2');
    assert.equal(options.headers.Authorization, `Bearer ${session.token}`);
    return json({ avaliacoes: [minha, outra], total: 12, media: 4.5, page: 2, limit: 10, hasMore: false });
  };

  assert.deepEqual(await h.avaliacoes.listarAvaliacoesDoLivro('OL100W', 2), {
    avaliacoes: [minha, outra],
    total: 12,
    media: 4.5,
    page: 2,
    hasMore: false,
  });
});

test('trata livro sem avaliações e resposta incompleta sem quebrar', async () => {
  const h = await logado();
  h.fetch = async () => json({ avaliacoes: [], total: 0, media: null, page: 1, hasMore: false });
  assert.deepEqual(await h.avaliacoes.listarAvaliacoesDoLivro('OL100W'), {
    avaliacoes: [],
    total: 0,
    media: null,
    page: 1,
    hasMore: false,
  });

  h.fetch = async () => json({});
  assert.deepEqual(await h.avaliacoes.listarAvaliacoesDoLivro('OL100W', 3), {
    avaliacoes: [],
    total: 0,
    media: null,
    page: 3,
    hasMore: false,
  });
});

test('busca e edita a própria avaliação pelo id', async () => {
  const h = await logado();
  const avaliacao = { id: 9, minha: true, nota: 4, resenha: 'Gostei bastante.' };
  h.fetch = async (url, options) => {
    assert.equal(url, 'http://localhost:3000/api/avaliacoes/9');
    assert.equal(options.method, 'GET');
    return json({ avaliacao });
  };
  assert.deepEqual(await h.avaliacoes.buscarAvaliacao(9), avaliacao);

  h.fetch = async (url, options) => {
    assert.equal(url, 'http://localhost:3000/api/avaliacoes/9');
    assert.equal(options.method, 'PUT');
    assert.deepEqual(JSON.parse(options.body), { nota: 2, resenha: 'Mudei de ideia.' });
    return json({ avaliacao: { ...avaliacao, nota: 2, resenha: 'Mudei de ideia.' } });
  };
  const editada = await h.avaliacoes.atualizarAvaliacao(9, { nota: 2, resenha: 'Mudei de ideia.' });
  assert.equal(editada.nota, 2);
});

test('repassa o 404 de avaliação removida', async () => {
  const h = await logado();
  h.fetch = async () => json({ error: 'Avaliação não encontrada' }, 404);
  await assert.rejects(h.avaliacoes.buscarAvaliacao(9), { status: 404 });
  await assert.rejects(h.avaliacoes.atualizarAvaliacao(9, { nota: 3, resenha: 'Texto novo.' }), {
    status: 404,
  });
});

test('junta páginas sem repetir avaliações e monta o resumo', () => {
  const { avaliacoes } = createServices();
  const a = (id) => ({ id });
  assert.deepEqual(avaliacoes.juntarAvaliacoes([a(1), a(2)], [a(2), a(3)]).map((x) => x.id), [1, 2, 3]);
  assert.deepEqual(avaliacoes.juntarAvaliacoes([], [a(4)]).map((x) => x.id), [4]);

  assert.equal(avaliacoes.formatarMedia(4.5), '4,5');
  assert.equal(avaliacoes.formatarMedia(4), '4,0');
  assert.equal(avaliacoes.formatarMedia(null), '');
  assert.equal(avaliacoes.resumoAvaliacoes(0, null), 'Nenhuma avaliação ainda');
  assert.equal(avaliacoes.resumoAvaliacoes(1, 5), 'Média 5,0 de 5 · 1 avaliação');
  assert.equal(avaliacoes.resumoAvaliacoes(12, 4.3), 'Média 4,3 de 5 · 12 avaliações');
});

test('lista as avaliações da sessão em /minhas, com o token de quem está logado', async () => {
  const h = await logado();
  const minhas = [
    { id: 9, minha: true, nota: 4, resenha: 'Gostei bastante.', livro: { id: 'OL1W', titulo: 'A' } },
    { id: 3, minha: true, nota: 2, resenha: 'Não me pegou.', livro: { id: 'OL2W', titulo: 'B' } },
  ];
  h.fetch = async (url, options) => {
    assert.equal(url, 'http://localhost:3000/api/avaliacoes/minhas');
    assert.equal(options.method, 'GET');
    assert.equal(options.headers.Authorization, `Bearer ${session.token}`);
    return json({ avaliacoes: minhas });
  };
  assert.deepEqual(await h.avaliacoes.listarMinhasAvaliacoes(), minhas);

  h.fetch = async () => json({});
  assert.deepEqual(await h.avaliacoes.listarMinhasAvaliacoes(), []);
});

test('exclui a própria avaliação pelo id e repassa 404 e 403', async () => {
  const h = await logado();
  h.fetch = async (url, options) => {
    assert.equal(url, 'http://localhost:3000/api/avaliacoes/9');
    assert.equal(options.method, 'DELETE');
    return json({ message: 'Avaliação excluída!' });
  };
  await h.avaliacoes.excluirAvaliacao(9);

  h.fetch = async () => json({ error: 'Avaliação não encontrada' }, 404);
  await assert.rejects(h.avaliacoes.excluirAvaliacao(9), { status: 404 });

  h.fetch = async () => json({ error: 'Você só pode alterar a sua própria avaliação' }, 403);
  await assert.rejects(h.avaliacoes.excluirAvaliacao(5), {
    status: 403,
    message: 'Você só pode alterar a sua própria avaliação',
  });
});

test('desenha a nota em estrelas dentro do intervalo de 0 a 5', () => {
  const { avaliacoes } = createServices();
  assert.equal(avaliacoes.estrelas(4), '★★★★☆');
  assert.equal(avaliacoes.estrelas(5), '★★★★★');
  assert.equal(avaliacoes.estrelas(0), '☆☆☆☆☆');
  assert.equal(avaliacoes.estrelas(7), '★★★★★');
});
