const assert = require('node:assert/strict');
const { afterEach, test } = require('node:test');

const { translateBookMetadata, translateTitles } = require('../src/services/bookTranslation');

const fetchOriginal = global.fetch;
const authKeyOriginal = process.env.DEEPL_AUTH_KEY;
const apiUrlOriginal = process.env.DEEPL_API_URL;

function respostaTraducao(translations) {
  return new Response(JSON.stringify({ translations }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  global.fetch = fetchOriginal;
  if (authKeyOriginal === undefined) delete process.env.DEEPL_AUTH_KEY;
  else process.env.DEEPL_AUTH_KEY = authKeyOriginal;
  if (apiUrlOriginal === undefined) delete process.env.DEEPL_API_URL;
  else process.env.DEEPL_API_URL = apiUrlOriginal;
});

test('usa traduções locais de categorias sem chamar serviço externo quando não há chave', async () => {
  delete process.env.DEEPL_AUTH_KEY;
  let chamadas = 0;
  global.fetch = async () => {
    chamadas += 1;
    throw new Error('Não deveria chamar a rede');
  };

  const result = await translateBookMetadata({
    description: 'An English synopsis.',
    categories: ['Fantasy', 'Mystery', 'Magical realism'],
  });

  assert.equal(chamadas, 0);
  assert.equal(result.description, 'An English synopsis.');
  assert.equal(result.descriptionTranslated, false);
  assert.deepEqual(result.categories, ['Fantasia', 'Mistério', 'Magical realism']);
  assert.equal(result.categoriesTranslated, false);
});

test('traduz sinopse e categorias desconhecidas em uma chamada e reutiliza o cache', async () => {
  process.env.DEEPL_AUTH_KEY = 'test-key:fx';
  delete process.env.DEEPL_API_URL;
  let chamadas = 0;
  global.fetch = async (url, options) => {
    chamadas += 1;
    assert.equal(url, 'https://api-free.deepl.com/v2/translate');
    assert.equal(options.headers.Authorization, 'DeepL-Auth-Key test-key:fx');
    const body = JSON.parse(options.body);
    assert.deepEqual(body, {
      text: ['A young reader discovers a hidden library.', 'Magical realism'],
      target_lang: 'PT-BR',
    });
    return respostaTraducao([
      { detected_source_language: 'EN', text: 'Uma jovem leitora descobre uma biblioteca secreta.' },
      { detected_source_language: 'EN', text: 'Realismo mágico' },
    ]);
  };

  const input = {
    description: 'A young reader discovers a hidden library.',
    categories: ['Fantasy', 'Magical realism'],
  };
  const first = await translateBookMetadata(input);
  first.categories[0] = 'alteração externa';
  const second = await translateBookMetadata(input);

  assert.equal(chamadas, 1);
  assert.equal(second.description, 'Uma jovem leitora descobre uma biblioteca secreta.');
  assert.equal(second.descriptionTranslated, true);
  assert.deepEqual(second.categories, ['Fantasia', 'Realismo mágico']);
  assert.equal(second.categoriesTranslated, true);
});

test('preserva uma sinopse que já está em português', async () => {
  process.env.DEEPL_AUTH_KEY = 'test-key';
  global.fetch = async () =>
    respostaTraducao([{ detected_source_language: 'PT', text: 'Uma história brasileira.' }]);

  const result = await translateBookMetadata({
    description: 'Uma história brasileira.',
    categories: ['Romance'],
  });

  assert.equal(result.description, 'Uma história brasileira.');
  assert.equal(result.descriptionTranslated, false);
  assert.deepEqual(result.categories, ['Romance']);
  assert.equal(result.categoriesTranslated, true);
});

test('falha do provedor não derruba o detalhe do livro e mantém o texto original', async () => {
  process.env.DEEPL_AUTH_KEY = 'test-key';
  global.fetch = async () => {
    throw new Error('serviço indisponível');
  };

  const result = await translateBookMetadata({
    description: 'A book description.',
    categories: ['Science fiction'],
  });

  assert.equal(result.description, 'A book description.');
  assert.equal(result.descriptionTranslated, false);
  assert.deepEqual(result.categories, ['Ficção científica']);
  assert.equal(result.categoriesTranslated, true);
});

test('não envia sinopses grandes ao provedor, mas continua traduzindo categorias', async () => {
  process.env.DEEPL_AUTH_KEY = 'test-key';
  global.fetch = async (_url, options) => {
    assert.deepEqual(JSON.parse(options.body).text, ['Unmapped topic']);
    return respostaTraducao([{ detected_source_language: 'EN', text: 'Tema sem mapeamento' }]);
  };

  const description = 'A'.repeat(10001);
  const result = await translateBookMetadata({ description, categories: ['Unmapped topic'] });

  assert.equal(result.description, description);
  assert.equal(result.descriptionTranslated, false);
  assert.deepEqual(result.categories, ['Tema sem mapeamento']);
  assert.equal(result.categoriesTranslated, true);
});

test('o título traduzido na busca não é cobrado de novo no detalhe do livro', async () => {
  process.env.DEEPL_AUTH_KEY = 'test-key';
  const enviados = [];
  global.fetch = async (_url, options) => {
    const { text } = JSON.parse(options.body);
    enviados.push(text);
    return respostaTraducao(
      text.map((item) => ({ detected_source_language: 'EN', text: `PT: ${item}` })),
    );
  };

  const [titulo] = await translateTitles(['A Study in Scarlet']);
  assert.deepEqual(titulo, { title: 'PT: A Study in Scarlet', titleTranslated: true });

  const detalhe = await translateBookMetadata({
    title: 'A Study in Scarlet',
    description: 'Sherlock meets Watson.',
    categories: ['Fantasy'],
  });

  // Só a sinopse foi ao DeepL no detalhe; o título veio do cache e a categoria do mapa local
  assert.deepEqual(enviados, [['A Study in Scarlet'], ['Sherlock meets Watson.']]);
  assert.equal(detalhe.title, 'PT: A Study in Scarlet');
  assert.equal(detalhe.description, 'PT: Sherlock meets Watson.');
  assert.deepEqual(detalhe.categories, ['Fantasia']);
});

test('títulos em português ficam como estão e falha do provedor devolve o original', async () => {
  process.env.DEEPL_AUTH_KEY = 'test-key';
  global.fetch = async () =>
    respostaTraducao([{ detected_source_language: 'PT', text: 'Memórias Póstumas' }]);
  assert.deepEqual(await translateTitles(['Memórias Póstumas']), [
    { title: 'Memórias Póstumas', titleTranslated: false },
  ]);

  global.fetch = async () => {
    throw new Error('fora do ar');
  };
  assert.deepEqual(await translateTitles(['Some Unseen Title', '']), [
    { title: 'Some Unseen Title', titleTranslated: false },
    { title: '', titleTranslated: false },
  ]);
});

test('sem chave do DeepL, os títulos voltam sem chamar a rede', async () => {
  delete process.env.DEEPL_AUTH_KEY;
  global.fetch = async () => assert.fail('não deveria chamar a rede');
  assert.deepEqual(await translateTitles(['Emma']), [{ title: 'Emma', titleTranslated: false }]);
});
