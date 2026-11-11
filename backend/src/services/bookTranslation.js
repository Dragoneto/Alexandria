const { createHash } = require('node:crypto');

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 300;
const REQUEST_TIMEOUT_MS = 3500;
const MAX_TEXT_LENGTH = 10000;

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
const cache = new Map();
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

function cacheKey(title, description, categories) {
  return createHash('sha256')
    .update(JSON.stringify([title, description, categories]))
    .digest('hex');
}

function lerCache(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (item.expiraEm <= Date.now()) {
    cache.delete(key);
    return null;
  }
  cache.delete(key);
  cache.set(key, item);
  return { ...item.result, categories: [...item.result.categories] };
}

function gravarCache(key, result) {
  while (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
  cache.set(key, {
    result: { ...result, categories: [...result.categories] },
    expiraEm: Date.now() + CACHE_TTL_MS,
  });
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

  const translated = await traduzirComDeepL(texts, authKey);
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

  let key;
  try {
    key = cacheKey(normalizedTitle, normalizedDescription, normalizedCategories);
  } catch {
    return resultadoFallback(normalizedTitle, normalizedDescription, normalizedCategories);
  }
  const cached = lerCache(key);
  if (cached) return cached;
  if (requisicoesEmAndamento.has(key)) {
    const pending = await requisicoesEmAndamento.get(key);
    return { ...pending, categories: [...pending.categories] };
  }

  const pending = (async () => {
    try {
      const outcome = await traduzirMetadata(normalizedTitle, normalizedDescription, normalizedCategories, authKey);
      if (outcome.translated) gravarCache(key, outcome.metadata);
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

module.exports = { translateBookMetadata };
