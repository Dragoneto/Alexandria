// Sorteio das estantes da home. Cada abertura da home monta uma combinação
// diferente de categorias, autores, termos de busca e páginas da Open Library.

/** Categorias aceitas pelo backend (CATEGORY_SUBJECTS no bookController). */
export const CATEGORIAS = [
  'Fantasia',
  'Romance',
  'História',
  'Tecnologia',
  'Biografia',
  'Mistério',
] as const;

export type Categoria = (typeof CATEGORIAS)[number];

/** Termos em inglês, o idioma em que a Open Library indexa a maior parte do acervo. */
const TERMOS_POR_CATEGORIA: Record<Categoria, readonly string[]> = {
  Fantasia: ['magic', 'dragons', 'wizards', 'fairy tales', 'kingdom', 'quest'],
  Romance: ['love', 'love story', 'wedding', 'heart', 'summer'],
  História: ['war', 'empire', 'revolution', 'ancient', 'kings'],
  Tecnologia: ['computers', 'internet', 'programming', 'robots', 'engineering'],
  Biografia: ['life', 'memoir', 'autobiography', 'letters', 'diary'],
  Mistério: ['detective', 'murder', 'crime', 'secret', 'mystery'],
};

/** Títulos alternativos para a mesma categoria não aparecer sempre igual. */
const TITULOS_POR_CATEGORIA: Record<Categoria, readonly string[]> = {
  Fantasia: ['Fantasia', 'Mundos mágicos', 'Para sair da realidade'],
  Romance: ['Romance', 'Histórias de amor', 'Para se apaixonar'],
  História: ['História', 'Viagem no tempo', 'Grandes acontecimentos'],
  Tecnologia: ['Tecnologia', 'Ciência e inovação', 'O futuro em páginas'],
  Biografia: ['Biografias', 'Vidas reais', 'Memórias'],
  Mistério: ['Mistério', 'Suspense e investigação', 'Quem foi?'],
};

export type Autor = {
  /** Como o nome aparece na estante. */
  nome: string;
  /** Como a Open Library indexa o autor (alguns estrangeiros só aparecem com a grafia em inglês). */
  busca: string;
};

const autor = (nome: string, busca = nome): Autor => ({ nome, busca });

/** 10 autores brasileiros. */
export const AUTORES_NACIONAIS: readonly Autor[] = [
  autor('Machado de Assis'),
  autor('Clarice Lispector'),
  autor('Jorge Amado'),
  autor('José de Alencar'),
  autor('Monteiro Lobato'),
  autor('Graciliano Ramos'),
  autor('Carlos Drummond de Andrade'),
  autor('Erico Verissimo'),
  autor('Paulo Coelho'),
  autor('Lima Barreto'),
];

/** 14 autores estrangeiros. */
export const AUTORES_INTERNACIONAIS: readonly Autor[] = [
  autor('Agatha Christie'),
  autor('Jane Austen'),
  autor('J. R. R. Tolkien'),
  autor('Gabriel García Márquez'),
  autor('Arthur Conan Doyle'),
  autor('Júlio Verne', 'Jules Verne'),
  autor('Charles Dickens'),
  autor('George Orwell'),
  autor('Fiódor Dostoiévski', 'Fyodor Dostoyevsky'),
  autor('Liev Tolstói', 'Leo Tolstoy'),
  autor('Victor Hugo'),
  autor('Ernest Hemingway'),
  autor('Stephen King'),
  autor('J. K. Rowling'),
];

export const AUTORES: readonly Autor[] = [...AUTORES_NACIONAIS, ...AUTORES_INTERNACIONAIS];

/** Até onde o sorteio vai nas páginas de resultado (páginas altas costumam vir vazias). */
export const PAGINA_MAXIMA = 3;

export type Estante = {
  /** Chave estável dentro de um sorteio, usada pelo React. */
  key: string;
  title: string;
  query: string;
  category?: Categoria;
  page: number;
};

type Aleatorio = () => number;

function inteiro(maximo: number, aleatorio: Aleatorio): number {
  return Math.min(maximo - 1, Math.floor(aleatorio() * maximo));
}

function sortear<T>(lista: readonly T[], aleatorio: Aleatorio): T {
  return lista[inteiro(lista.length, aleatorio)];
}

/** Fisher-Yates: devolve uma cópia embaralhada, sem alterar a lista original. */
export function embaralhar<T>(lista: readonly T[], aleatorio: Aleatorio = Math.random): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = inteiro(i + 1, aleatorio);
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/** Termo de busca sorteado para uma categoria. */
export function termoDaCategoria(categoria: Categoria, aleatorio: Aleatorio = Math.random): string {
  return sortear(TERMOS_POR_CATEGORIA[categoria], aleatorio);
}

const estanteDeAutor = (escolhido: Autor, aleatorio: Aleatorio): Estante => ({
  key: `autor:${escolhido.busca}`,
  title: escolhido.nome,
  query: escolhido.busca,
  page: 1 + inteiro(PAGINA_MAXIMA, aleatorio),
});

/**
 * Monta as estantes da home: primeiro as categorias (diferentes entre si), depois
 * os autores, um brasileiro e um estrangeiro. Termos e páginas são sorteados.
 */
export function sortearEstantes(
  { categorias = 3 }: { categorias?: number } = {},
  aleatorio: Aleatorio = Math.random,
): Estante[] {
  const deCategorias = embaralhar(CATEGORIAS, aleatorio)
    .slice(0, categorias)
    .map<Estante>((categoria) => ({
      key: `categoria:${categoria}`,
      title: sortear(TITULOS_POR_CATEGORIA[categoria], aleatorio),
      query: termoDaCategoria(categoria, aleatorio),
      category: categoria,
      page: 1 + inteiro(PAGINA_MAXIMA, aleatorio),
    }));

  const deAutores = [
    estanteDeAutor(sortear(AUTORES_NACIONAIS, aleatorio), aleatorio),
    estanteDeAutor(sortear(AUTORES_INTERNACIONAIS, aleatorio), aleatorio),
  ];

  return [...deCategorias, ...deAutores];
}

/** Busca usada para o livro em destaque no topo da home. */
export function sortearDestaque(
  aleatorio: Aleatorio = Math.random,
): Omit<Estante, 'key' | 'title'> {
  if (aleatorio() < 0.5) {
    return { query: sortear(AUTORES, aleatorio).busca, page: 1 };
  }
  const categoria = sortear(CATEGORIAS, aleatorio);
  return {
    query: termoDaCategoria(categoria, aleatorio),
    category: categoria,
    page: 1 + inteiro(PAGINA_MAXIMA, aleatorio),
  };
}
