const { createHash } = require('node:crypto');
const traducoes = require('../repositories/traducaoRepository');

const REQUEST_TIMEOUT_MS = 3500;
const MAX_TEXT_LENGTH = 10000;
// O DeepL cobra por caractere enviado. Cada texto vai ao provedor uma vez só:
// fica num cache em memória e também no PostgreSQL (tabela traducoes).
const MAX_TEXTOS_EM_MEMORIA = 5000;
// Limite de textos por requisição da API do DeepL
const TEXTOS_POR_REQUISICAO = 50;

const CATEGORY_TRANSLATIONS = new Map([
  ['adventure', 'Aventura'],
  ['art', 'Arte'],
  ['biography', 'Biografia'],
  ['business', 'Negócios'],
  ['children s fiction', 'Ficção infantil'],
  ['classics', 'Clássicos'],
  ['cooking', 'Culinária'],
  ['computers', 'Computação'],
  ['detective and mystery stories', 'Romance policial e mistério'],
  ['drama', 'Drama'],
  ['education', 'Educação'],
  ['fantasy', 'Fantasia'],
  ['fiction', 'Ficção'],
  ['health', 'Saúde'],
  ['historical fiction', 'Ficção histórica'],
  ['history', 'História'],
  ['horror', 'Terror'],
  ['humor', 'Humor'],
  ['juvenile fiction', 'Ficção juvenil'],
  ['literature', 'Literatura'],
  ['mystery', 'Mistério'],
  ['nonfiction', 'Não ficção'],
  ['philosophy', 'Filosofia'],
  ['poetry', 'Poesia'],
  ['psychology', 'Psicologia'],
  ['religion', 'Religião'],
  ['romance', 'Romance'],
  ['science', 'Ciência'],
  ['science fiction', 'Ficção científica'],
  ['social science', 'Ciências sociais'],
  ['technology', 'Tecnologia'],
  ['thrillers', 'Suspense'],
  ['travel', 'Viagem'],
  ['young adult fiction', 'Ficção para jovens adultos'],
]);

const CATEGORIAS_PT = new Set(
  [...CATEGORY_TRANSLATIONS.values()].map((value) => normalizarCategoria(value)),
);
const cacheDeTextos = new Map();
const requisicoesEmAndamento = new Map();

function normalizarCategoria(value) {
  return typeof value === 'string'
    ? value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[_-]+/g, ' ')
        .replace(/[^a-z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    : '';
}

function limparCategorias(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()))].slice(0, 5);
}

function resultadoFallback(title, description, categories) {
  const categorias = limparCategorias(categories).map(
    (category) => CATEGORY_TRANSLATIONS.get(normalizarCategoria(category)) ?? category,
  );
  const categoriasTraduzidas = limparCategorias(categories).every((category) => {
    const key = normalizarCategoria(category);
    return CATEGORY_TRANSLATIONS.has(key) || CATEGORIAS_PT.has(key);
  });

  return {
    title: typeof title === 'string' && title.trim() ? title.trim() : '',
    titleTranslated: false,
    description: typeof description === 'string' && description.trim() ? description.trim() : null,
    categories: categorias,
    descriptionTranslated: false,
    categoriesTranslated: categoriasTraduzidas,
  };
}

function baseUrl(authKey) {
  const configured = process.env.DEEPL_API_URL?.trim();
  const fallback = authKey.endsWith(':fx')
    ? 'https://api-free.deepl.com'
    : 'https://api.deepl.com';
  const url = new URL(configured || fallback);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('DEEPL_API_URL inválida');
  }
  return url.toString().replace(/\/+$/, '');
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function chaveDoTexto(texto) {
  return hash(`PT-BR\u0000${texto}`);
}

function guardarNaMemoria(chave, item) {
  cacheDeTextos.delete(chave);
  while (cacheDeTextos.size >= MAX_TEXTOS_EM_MEMORIA) cacheDeTextos.delete(cacheDeTextos.keys().next().value);
  cacheDeTextos.set(chave, item);
}

async function traduzirComDeepL(texts, authKey) {
  const response = await fetch(`${baseUrl(authKey)}/v2/translate`, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${authKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ text: texts, target_lang: 'PT-BR' }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) return null;
  const payload = await response.json();
  if (!Array.isArray(payload?.translations) || payload.translations.length !== texts.length) return null;
  if (payload.translations.some((item) => typeof item?.text !== 'string' || !item.text.trim())) return null;
  return payload.translations;
}

/**
 * Traduz uma lista de textos mandando ao DeepL só o que nunca foi traduzido,
 * em lotes. Devolve um item { text, detected_source_language } por texto, na
 * mesma ordem, ou null se o provedor falhar.
 */
async function traduzirTextos(texts, authKey) {
  const chaves = texts.map(chaveDoTexto);
  const encontrados = new Map();

  chaves.forEach((chave) => {
    const item = cacheDeTextos.get(chave);
    if (item) {
      guardarNaMemoria(chave, item);
      encontrados.set(chave, item);
    }
  });

  const semMemoria = [...new Set(chaves.filter((chave) => !encontrados.has(chave)))];
  if (semMemoria.length) {
    const doBanco = await traducoes.buscar(semMemoria).catch(() => new Map());
    doBanco.forEach((item, chave) => {
      guardarNaMemoria(chave, item);
      encontrados.set(chave, item);
    });
  }

  const pendentes = new Map();
  chaves.forEach((chave, index) => {
    if (!encontrados.has(chave)) pendentes.set(chave, texts[index]);
  });
  const novas = [];
  const lista = [...pendentes];
  for (let inicio = 0; inicio < lista.length; inicio += TEXTOS_POR_REQUISICAO) {
    const lote = lista.slice(inicio, inicio + TEXTOS_POR_REQUISICAO);
    const translated = await traduzirComDeepL(lote.map(([, texto]) => texto), authKey);
    if (!translated) return null;
    translated.forEach((item, index) => {
      const [chave] = lote[index];
      const entrada = { text: item.text.trim(), lang: item.detected_source_language ?? null };
      guardarNaMemoria(chave, entrada);
      encontrados.set(chave, entrada);
      novas.push({ chave, ...entrada });
    });
  }
  if (novas.length) await traducoes.salvar(novas).catch(() => {});

  return chaves.map((chave) => {
    const item = encontrados.get(chave);
    return { text: item.text, detected_source_language: item.lang ?? undefined };
  });
}

async function traduzirMetadata(title, description, categories, authKey) {
  const fallback = resultadoFallback(title, description, categories);
  const texts = [];
  const targets = [];

  if (typeof title === 'string' && title.trim() && title.length <= MAX_TEXT_LENGTH) {
    texts.push(title.trim());
    targets.push({ type: 'title' });
  }

  if (typeof description === 'string' && description.trim() && description.length <= MAX_TEXT_LENGTH) {
    texts.push(description.trim());
    targets.push({ type: 'description' });
  }

  const originalCategories = limparCategorias(categories);
  originalCategories.forEach((category, index) => {
    const key = normalizarCategoria(category);
    if (CATEGORY_TRANSLATIONS.has(key) || CATEGORIAS_PT.has(key) || category.length > MAX_TEXT_LENGTH) return;
    texts.push(category);
    targets.push({ type: 'category', index });
  });

  if (!texts.length) return { metadata: fallback, translated: false };

  const translated = await traduzirTextos(texts, authKey);
  if (!translated) return { metadata: fallback, translated: false };

  let translatedDescription = fallback.description;
  let translatedTitle = fallback.title;
  let titleTranslated = false;
  let descriptionTranslated = false;
  const translatedCategories = [...fallback.categories];
  const categoriesTranslated = originalCategories.map((category) =>
    CATEGORY_TRANSLATIONS.has(normalizarCategoria(category)) ||
    CATEGORIAS_PT.has(normalizarCategoria(category)),
  );

  translated.forEach((item, index) => {
    const target = targets[index];
    const sourceIsPortuguese = /^PT(?:-|$)/i.test(item.detected_source_language ?? '');
    if (target.type === 'title') {
      if (!sourceIsPortuguese) {
        translatedTitle = item.text.trim();
        titleTranslated = true;
      }
      return;
    }
    if (target.type === 'description') {
      if (!sourceIsPortuguese) {
        translatedDescription = item.text.trim();
        descriptionTranslated = true;
      }
      return;
    }
    if (sourceIsPortuguese) {
      categoriesTranslated[target.index] = true;
      return;
    }
    translatedCategories[target.index] = item.text.trim();
    categoriesTranslated[target.index] = true;
  });

  return {
    metadata: {
      title: translatedTitle,
      titleTranslated,
      description: translatedDescription,
      categories: [...new Set(translatedCategories)],
      descriptionTranslated,
      categoriesTranslated: categoriesTranslated.every(Boolean),
    },
    translated: true,
  };
}

async function translateBookMetadata({ title, description, categories }) {
  const normalizedTitle = typeof title === 'string' && title.trim() ? title.trim() : '';
  const normalizedDescription = typeof description === 'string' && description.trim() ? description.trim() : null;
  const normalizedCategories = limparCategorias(categories);
  const authKey = process.env.DEEPL_AUTH_KEY?.trim();
  if (!authKey) return resultadoFallback(normalizedTitle, normalizedDescription, normalizedCategories);

  // Pedidos iguais ao mesmo tempo esperam a mesma tradução
  const key = hash(JSON.stringify([normalizedTitle, normalizedDescription, normalizedCategories]));
  if (requisicoesEmAndamento.has(key)) {
    const pending = await requisicoesEmAndamento.get(key);
    return { ...pending, categories: [...pending.categories] };
  }

  const pending = (async () => {
    try {
      const outcome = await traduzirMetadata(normalizedTitle, normalizedDescription, normalizedCategories, authKey);
      return { ...outcome.metadata, categories: [...outcome.metadata.categories] };
    } catch {
      return resultadoFallback(normalizedTitle, normalizedDescription, normalizedCategories);
    } finally {
      requisicoesEmAndamento.delete(key);
    }
  })();
  requisicoesEmAndamento.set(key, pending);
  const result = await pending;
  return { ...result, categories: [...result.categories] };
}

/**
 * Traduz só os títulos de uma página de busca, todos numa chamada. Assuntos e
 * sinopses ficam para o detalhe do livro, que é onde o app mostra.
 */
async function translateTitles(titles) {
  const limpos = titles.map((title) => (typeof title === 'string' ? title.trim() : ''));
  const original = () => limpos.map((title) => ({ title, titleTranslated: false }));
  const authKey = process.env.DEEPL_AUTH_KEY?.trim();
  if (!authKey) return original();

  const enviar = [...new Set(limpos.filter((title) => title && title.length <= MAX_TEXT_LENGTH))];
  if (!enviar.length) return original();

  let translated;
  try {
    translated = await traduzirTextos(enviar, authKey);
  } catch {
    translated = null;
  }
  if (!translated) return original();

  const porTitulo = new Map(enviar.map((title, index) => [title, translated[index]]));
  return limpos.map((title) => {
    const item = porTitulo.get(title);
    const sourceIsPortuguese = /^PT(?:-|$)/i.test(item?.detected_source_language ?? '');
    if (!item || sourceIsPortuguese || !item.text) return { title, titleTranslated: false };
    return { title: item.text, titleTranslated: true };
  });
}

module.exports = { translateBookMetadata, translateTitles };
