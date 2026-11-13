// Categorias do app, na estrutura da página "Browse by Subject" da Open Library.
// É uma cópia só com os nomes de backend/src/constants/categorias.js (lá cada nome vira um filtro
// da busca); o teste tests/categorias.test.cjs confere que as duas listas continuam iguais.

export type GrupoDeCategorias = { nome: string; subcategorias: readonly string[] };

export const GRUPOS_DE_CATEGORIAS: readonly GrupoDeCategorias[] = [
  {
    nome: 'Artes',
    subcategorias: [
      'Arquitetura',
      'Ensino de arte',
      'História da arte',
      'Dança',
      'Design',
      'Moda',
      'Cinema',
      'Design gráfico',
      'Música',
      'Teoria musical',
      'Pintura',
      'Fotografia',
    ],
  },
  {
    nome: 'Animais',
    subcategorias: ['Ursos', 'Gatos', 'Gatinhos', 'Cães', 'Filhotes de cachorro'],
  },
  {
    nome: 'Ficção',
    subcategorias: [
      'Fantasia',
      'Ficção histórica',
      'Terror',
      'Humor',
      'Literatura',
      'Magia',
      'Mistério',
      'Teatro',
      'Poesia',
      'Romance',
      'Ficção científica',
      'Contos',
      'Suspense',
      'Jovem adulto',
    ],
  },
  {
    nome: 'Ciência e matemática',
    subcategorias: ['Biologia', 'Química', 'Matemática', 'Física', 'Programação', 'Tecnologia'],
  },
  {
    nome: 'Negócios e finanças',
    subcategorias: ['Gestão', 'Empreendedorismo', 'Economia', 'Sucesso profissional', 'Finanças'],
  },
  {
    nome: 'Infantil',
    subcategorias: [
      'Livros infantis',
      'Histórias em rima',
      'Livros para bebês',
      'Histórias para dormir',
      'Livros ilustrados',
    ],
  },
  {
    nome: 'História',
    subcategorias: [
      'Civilizações antigas',
      'Arqueologia',
      'Antropologia',
      'Segunda Guerra Mundial',
      'Vida e costumes',
    ],
  },
  {
    nome: 'Saúde e bem-estar',
    subcategorias: [
      'Culinária',
      'Livros de receitas',
      'Saúde mental',
      'Exercícios',
      'Nutrição',
      'Autoajuda',
    ],
  },
  {
    nome: 'Biografia',
    subcategorias: [
      'Autobiografias',
      'Biografias históricas',
      'Política e governo',
      'Biografias da Segunda Guerra',
      'Mulheres',
      'Reis e governantes',
      'Compositores',
      'Artistas',
    ],
  },
  {
    nome: 'Ciências sociais',
    subcategorias: ['Religião', 'Ciência política', 'Psicologia'],
  },
  {
    nome: 'Lugares',
    subcategorias: ['Brasil', 'Índia', 'Indonésia', 'Estados Unidos'],
  },
];

/** Grupos e subcategorias: tudo que o backend aceita em `category`. */
export const TODAS_AS_CATEGORIAS: readonly string[] = GRUPOS_DE_CATEGORIAS.flatMap((grupo) => [
  grupo.nome,
  ...grupo.subcategorias,
]);

export function ehCategoria(valor: string): boolean {
  return TODAS_AS_CATEGORIAS.includes(valor);
}

/** Grupo de uma categoria: o próprio grupo, ou o grupo onde a subcategoria está. */
export function grupoDaCategoria(nome: string): GrupoDeCategorias | undefined {
  return GRUPOS_DE_CATEGORIAS.find(
    (grupo) => grupo.nome === nome || grupo.subcategorias.includes(nome),
  );
}
