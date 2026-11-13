// Catálogo de categorias, na estrutura da página "Browse by Subject" da Open Library
// (https://openlibrary.org/subjects). O app tem uma cópia em mobile/src/constants/categorias.ts;
// um teste do app confere que as duas listas são iguais.
//
// Cada categoria vira um filtro na busca da Open Library (`subject:` ou `place:`). Os grupos de
// idiomas e de livros didáticos da página ficaram de fora a pedido do time.
// O nome em português é o que o app manda em `category` e precisa ser único.

/** @type {{ nome: string, filtro: string, subcategorias: { nome: string, filtro: string }[] }[]} */
const GRUPOS = [
  {
    nome: 'Artes',
    filtro: 'subject:art',
    subcategorias: [
      { nome: 'Arquitetura', filtro: 'subject:architecture' },
      { nome: 'Ensino de arte', filtro: 'subject:"art instruction"' },
      { nome: 'História da arte', filtro: 'subject:"art history"' },
      { nome: 'Dança', filtro: 'subject:dance' },
      { nome: 'Design', filtro: 'subject:design' },
      { nome: 'Moda', filtro: 'subject:fashion' },
      { nome: 'Cinema', filtro: 'subject:film' },
      { nome: 'Design gráfico', filtro: 'subject:"graphic design"' },
      { nome: 'Música', filtro: 'subject:music' },
      { nome: 'Teoria musical', filtro: 'subject:"music theory"' },
      { nome: 'Pintura', filtro: 'subject:painting' },
      { nome: 'Fotografia', filtro: 'subject:photography' },
    ],
  },
  {
    nome: 'Animais',
    filtro: 'subject:animals',
    subcategorias: [
      { nome: 'Ursos', filtro: 'subject:bears' },
      { nome: 'Gatos', filtro: 'subject:cats' },
      { nome: 'Gatinhos', filtro: 'subject:kittens' },
      { nome: 'Cães', filtro: 'subject:dogs' },
      { nome: 'Filhotes de cachorro', filtro: 'subject:puppies' },
    ],
  },
  {
    nome: 'Ficção',
    filtro: 'subject:fiction',
    subcategorias: [
      { nome: 'Fantasia', filtro: 'subject:fantasy' },
      { nome: 'Ficção histórica', filtro: 'subject:"historical fiction"' },
      { nome: 'Terror', filtro: 'subject:horror' },
      { nome: 'Humor', filtro: 'subject:humor' },
      { nome: 'Literatura', filtro: 'subject:literature' },
      { nome: 'Magia', filtro: 'subject:magic' },
      { nome: 'Mistério', filtro: 'subject:mystery' },
      { nome: 'Teatro', filtro: 'subject:plays' },
      { nome: 'Poesia', filtro: 'subject:poetry' },
      { nome: 'Romance', filtro: 'subject:romance' },
      { nome: 'Ficção científica', filtro: 'subject:"science fiction"' },
      { nome: 'Contos', filtro: 'subject:"short stories"' },
      { nome: 'Suspense', filtro: 'subject:thriller' },
      { nome: 'Jovem adulto', filtro: 'subject:"young adult fiction"' },
    ],
  },
  {
    nome: 'Ciência e matemática',
    filtro: 'subject:science',
    subcategorias: [
      { nome: 'Biologia', filtro: 'subject:biology' },
      { nome: 'Química', filtro: 'subject:chemistry' },
      { nome: 'Matemática', filtro: 'subject:mathematics' },
      { nome: 'Física', filtro: 'subject:physics' },
      { nome: 'Programação', filtro: 'subject:programming' },
      // Não está na página da Open Library; vem das categorias antigas do app.
      { nome: 'Tecnologia', filtro: 'subject:technology' },
    ],
  },
  {
    nome: 'Negócios e finanças',
    filtro: 'subject:business',
    subcategorias: [
      { nome: 'Gestão', filtro: 'subject:management' },
      { nome: 'Empreendedorismo', filtro: 'subject:entrepreneurship' },
      { nome: 'Economia', filtro: 'subject:"business economics"' },
      { nome: 'Sucesso profissional', filtro: 'subject:success' },
      { nome: 'Finanças', filtro: 'subject:finance' },
    ],
  },
  {
    nome: 'Infantil',
    filtro: 'subject:"juvenile literature"',
    subcategorias: [
      { nome: 'Livros infantis', filtro: 'subject:"juvenile fiction"' },
      { nome: 'Histórias em rima', filtro: 'subject:"stories in rhyme"' },
      { nome: 'Livros para bebês', filtro: 'subject:"baby books"' },
      { nome: 'Histórias para dormir', filtro: 'subject:bedtime' },
      { nome: 'Livros ilustrados', filtro: 'subject:"picture books"' },
    ],
  },
  {
    nome: 'História',
    filtro: 'subject:history',
    subcategorias: [
      { nome: 'Civilizações antigas', filtro: 'subject:"ancient civilization"' },
      { nome: 'Arqueologia', filtro: 'subject:archaeology' },
      { nome: 'Antropologia', filtro: 'subject:anthropology' },
      { nome: 'Segunda Guerra Mundial', filtro: 'subject:"world war, 1939-1945"' },
      { nome: 'Vida e costumes', filtro: 'subject:"social life and customs"' },
    ],
  },
  {
    nome: 'Saúde e bem-estar',
    filtro: 'subject:health',
    subcategorias: [
      { nome: 'Culinária', filtro: 'subject:cooking' },
      { nome: 'Livros de receitas', filtro: 'subject:cookbooks' },
      { nome: 'Saúde mental', filtro: 'subject:"mental health"' },
      { nome: 'Exercícios', filtro: 'subject:exercise' },
      { nome: 'Nutrição', filtro: 'subject:nutrition' },
      { nome: 'Autoajuda', filtro: 'subject:"self-help"' },
    ],
  },
  {
    nome: 'Biografia',
    filtro: 'subject:biography',
    subcategorias: [
      { nome: 'Autobiografias', filtro: 'subject:autobiography' },
      { nome: 'Biografias históricas', filtro: 'subject:biography subject:history' },
      { nome: 'Política e governo', filtro: 'subject:biography subject:"politics and government"' },
      { nome: 'Biografias da Segunda Guerra', filtro: 'subject:biography subject:"world war, 1939-1945"' },
      { nome: 'Mulheres', filtro: 'subject:biography subject:women' },
      { nome: 'Reis e governantes', filtro: 'subject:biography subject:"kings and rulers"' },
      { nome: 'Compositores', filtro: 'subject:biography subject:composers' },
      { nome: 'Artistas', filtro: 'subject:biography subject:artists' },
    ],
  },
  {
    nome: 'Ciências sociais',
    filtro: 'subject:"social sciences"',
    subcategorias: [
      { nome: 'Religião', filtro: 'subject:religion' },
      { nome: 'Ciência política', filtro: 'subject:"political science"' },
      { nome: 'Psicologia', filtro: 'subject:psychology' },
    ],
  },
  {
    nome: 'Lugares',
    // "Tudo em Lugares" junta os quatro lugares, e não só o primeiro.
    filtro: 'place:(brazil OR india OR indonesia OR "united states")',
    subcategorias: [
      { nome: 'Brasil', filtro: 'place:brazil' },
      { nome: 'Índia', filtro: 'place:india' },
      { nome: 'Indonésia', filtro: 'place:indonesia' },
      { nome: 'Estados Unidos', filtro: 'place:"united states"' },
    ],
  },
];

/** Nome em português → filtro da Open Library, para grupos e subcategorias. */
const FILTRO_POR_CATEGORIA = new Map(
  GRUPOS.flatMap((grupo) => [
    [grupo.nome, grupo.filtro],
    ...grupo.subcategorias.map((sub) => [sub.nome, sub.filtro]),
  ]),
);

module.exports = { GRUPOS, FILTRO_POR_CATEGORIA };
