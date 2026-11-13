// Sorteio das estantes da home. Cada abertura da home monta uma combinação
// diferente de categorias, autores e páginas da Open Library.

import { GRUPOS_DE_CATEGORIAS, TODAS_AS_CATEGORIAS } from '@/constants/categorias';

/** Grupos da Open Library (Artes, Animais, Ficção…): os atalhos de categoria da home. */
export const CATEGORIAS: readonly string[] = GRUPOS_DE_CATEGORIAS.map((grupo) => grupo.nome);

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
  /** Vazio nas estantes de categoria: a busca é só pela categoria. */
  query: string;
  category?: string;
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

const estanteDeAutor = (escolhido: Autor, aleatorio: Aleatorio): Estante => ({
  key: `autor:${escolhido.busca}`,
  title: escolhido.nome,
  query: escolhido.busca,
  page: 1 + inteiro(PAGINA_MAXIMA, aleatorio),
});

/**
 * Monta as estantes da home: primeiro as categorias (diferentes entre si, entre todos os grupos e
 * subcategorias), depois os autores, um brasileiro e um estrangeiro. As páginas são sorteadas.
 */
export function sortearEstantes(
  { categorias = 3 }: { categorias?: number } = {},
  aleatorio: Aleatorio = Math.random,
): Estante[] {
  const deCategorias = embaralhar(TODAS_AS_CATEGORIAS, aleatorio)
    .slice(0, categorias)
    .map<Estante>((categoria) => ({
      key: `categoria:${categoria}`,
      title: categoria,
      query: '',
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
  return {
    query: '',
    category: sortear(TODAS_AS_CATEGORIAS, aleatorio),
    page: 1 + inteiro(PAGINA_MAXIMA, aleatorio),
  };
}
