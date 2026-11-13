// Curiosidades da tela "Você sabia?". Para acrescentar uma, copie um bloco e use um id novo.

export const CATEGORIAS_CURIOSIDADES = [
  'História',
  'Literatura',
  'Brasil',
  'Palavras',
  'Ciência',
  'Invenções',
  'Recordes',
  'Bibliotecas',
] as const;

export type CategoriaCuriosidade = (typeof CATEGORIAS_CURIOSIDADES)[number];

export type Curiosidade = { id: number; categoria: CategoriaCuriosidade; texto: string };

export const CURIOSIDADES: readonly Curiosidade[] = [
  // História
  {
    id: 1,
    categoria: 'História',
    texto:
      'A Biblioteca de Alexandria, no Egito, foi fundada há mais de 2.200 anos e pode ter guardado centenas de milhares de rolos de papiro. Ela inspirou o nome deste app.',
  },
  {
    id: 2,
    categoria: 'História',
    texto:
      'Os egípcios escreviam em papiro, uma folha feita com a planta de mesmo nome que crescia às margens do rio Nilo.',
  },
  {
    id: 3,
    categoria: 'História',
    texto:
      'A Epopeia de Gilgamesh, da antiga Mesopotâmia, é uma das obras literárias mais antigas que se conhecem: seus primeiros poemas têm cerca de 4 mil anos.',
  },
  {
    id: 4,
    categoria: 'História',
    texto:
      'O livro com páginas costuradas, chamado códice, se espalhou no Império Romano e foi substituindo os rolos entre os séculos I e IV.',
  },
  {
    id: 5,
    categoria: 'História',
    texto:
      'O papel nasceu na China. A técnica é atribuída a Cai Lun, um funcionário da corte, por volta do ano 105.',
  },
  {
    id: 6,
    categoria: 'História',
    texto:
      'Na Idade Média, monges copistas reproduziam livros à mão nos mosteiros. Copiar uma Bíblia inteira podia levar anos.',
  },

  // Literatura
  {
    id: 7,
    categoria: 'Literatura',
    texto:
      'Dom Quixote, de Miguel de Cervantes, publicado em 1605, é considerado por muitos o primeiro romance moderno.',
  },
  {
    id: 8,
    categoria: 'Literatura',
    texto:
      'O Pequeno Príncipe, de Antoine de Saint-Exupéry, é um dos livros mais traduzidos do mundo, com versões em centenas de idiomas e dialetos.',
  },
  {
    id: 9,
    categoria: 'Literatura',
    texto:
      'Mary Shelley começou a escrever Frankenstein aos 18 anos. O livro saiu em 1818 e é apontado como uma das primeiras obras de ficção científica.',
  },
  {
    id: 10,
    categoria: 'Literatura',
    texto:
      'Segundo o Guinness, Agatha Christie é a autora de ficção mais vendida da história, com estimativas de mais de 2 bilhões de exemplares.',
  },
  {
    id: 11,
    categoria: 'Literatura',
    texto:
      'Sherlock Holmes apareceu pela primeira vez em "Um Estudo em Vermelho", de Arthur Conan Doyle, publicado em 1887.',
  },
  {
    id: 12,
    categoria: 'Literatura',
    texto:
      'J. R. R. Tolkien era professor de línguas em Oxford e inventou idiomas inteiros para a Terra-média, como o quenya e o sindarin.',
  },
  {
    id: 13,
    categoria: 'Literatura',
    texto:
      'Ulisses, de James Joyce, se passa todo em um único dia: 16 de junho de 1904. A data é celebrada pelos fãs como Bloomsday.',
  },

  // Brasil
  {
    id: 14,
    categoria: 'Brasil',
    texto:
      'Machado de Assis foi um dos fundadores da Academia Brasileira de Letras, em 1897, e o seu primeiro presidente.',
  },
  {
    id: 15,
    categoria: 'Brasil',
    texto:
      'A Biblioteca Nacional, no Rio de Janeiro, foi fundada em 1810 com o acervo da Real Biblioteca portuguesa, trazido depois da chegada da corte.',
  },
  {
    id: 16,
    categoria: 'Brasil',
    texto:
      'O Dia Nacional do Livro, 29 de outubro, lembra justamente a fundação da Biblioteca Nacional.',
  },
  {
    id: 17,
    categoria: 'Brasil',
    texto: 'Clarice Lispector nasceu na Ucrânia, em 1920, e chegou ao Brasil ainda bebê.',
  },
  {
    id: 18,
    categoria: 'Brasil',
    texto:
      'Jorge Amado está entre os escritores brasileiros mais traduzidos: seus livros saíram em dezenas de idiomas.',
  },
  {
    id: 19,
    categoria: 'Brasil',
    texto:
      'Carolina Maria de Jesus escreveu "Quarto de Despejo" (1960) a partir dos diários que mantinha na favela do Canindé, em São Paulo. O livro foi traduzido para mais de dez idiomas.',
  },
  {
    id: 20,
    categoria: 'Brasil',
    texto:
      'Monteiro Lobato criou o Sítio do Picapau Amarelo. "A Menina do Narizinho Arrebitado", o primeiro livro da turma, saiu em 1920.',
  },
  {
    id: 21,
    categoria: 'Brasil',
    texto:
      'O Dia Nacional do Livro Infantil, 18 de abril, homenageia o aniversário de Monteiro Lobato.',
  },

  // Palavras
  {
    id: 22,
    categoria: 'Palavras',
    texto:
      '"Tsundoku" é uma palavra japonesa para o hábito de comprar livros e deixá-los empilhados sem ler. Conhece alguém assim?',
  },
  {
    id: 23,
    categoria: 'Palavras',
    texto:
      'A palavra "livro" vem do latim "liber", nome da parte interna da casca das árvores, que já foi usada como suporte para escrever.',
  },
  {
    id: 24,
    categoria: 'Palavras',
    texto:
      '"Biblioteca" vem do grego "bibliothéke": "biblíon" (livro) mais "théke" (caixa, depósito).',
  },
  {
    id: 25,
    categoria: 'Palavras',
    texto:
      'Bibliófilo é quem ama e coleciona livros. Já a bibliomania é a vontade exagerada de juntar cada vez mais deles.',
  },
  {
    id: 26,
    categoria: 'Palavras',
    texto:
      '"Bibliosmia" é um nome informal para o prazer de sentir o cheiro de livros, novos ou antigos.',
  },
  {
    id: 27,
    categoria: 'Palavras',
    texto: '"Abibliofobia" é o termo bem-humorado para o medo de ficar sem nada para ler.',
  },
  {
    id: 28,
    categoria: 'Palavras',
    texto:
      'Palíndromos são frases que se leem igual de trás para frente, como "Socorram-me, subi no ônibus em Marrocos".',
  },

  // Ciência
  {
    id: 29,
    categoria: 'Ciência',
    texto:
      'O cheiro de livro antigo vem do papel se desgastando com o tempo. Esse processo libera substâncias como a vanilina, que lembra baunilha.',
  },
  {
    id: 30,
    categoria: 'Ciência',
    texto:
      'Ao ler, os olhos não deslizam pela linha: eles dão pequenos saltos, chamados sacadas, e param por frações de segundo em cada trecho.',
  },
  {
    id: 31,
    categoria: 'Ciência',
    texto:
      'Na Antiguidade, o normal era ler em voz alta. A leitura silenciosa, só com os olhos, chegou a causar espanto em quem a via.',
  },
  {
    id: 32,
    categoria: 'Ciência',
    texto:
      'Papel ácido amarelece e fica quebradiço com o tempo. Por isso existe o papel alcalino, feito para durar séculos.',
  },
  {
    id: 33,
    categoria: 'Ciência',
    texto:
      'As manchas marrons em livros antigos têm nome: "foxing". Elas surgem com umidade, fungos e a oxidação de partículas de metal no papel.',
  },
  {
    id: 34,
    categoria: 'Ciência',
    texto:
      'Alguns estudos sugerem que ler ficção ajuda a desenvolver empatia, porque imaginar a vida dos personagens exercita a capacidade de entender os outros.',
  },

  // Invenções
  {
    id: 35,
    categoria: 'Invenções',
    texto:
      'Por volta de 1450, Johannes Gutenberg criou a prensa de tipos móveis. Antes disso, os livros eram copiados à mão, um por um.',
  },
  {
    id: 36,
    categoria: 'Invenções',
    texto:
      'O braile, sistema de leitura com pontos em relevo, foi criado por Louis Braille, um jovem francês que perdeu a visão na infância, e publicado em 1829.',
  },
  {
    id: 37,
    categoria: 'Invenções',
    texto:
      'Os livros de bolso ganharam o mundo em 1935, quando a editora britânica Penguin lançou edições baratas de capa mole.',
  },
  {
    id: 38,
    categoria: 'Invenções',
    texto:
      'O ISBN, o código que identifica cada edição de um livro, surgiu nos anos 1960 e virou padrão internacional em 1970.',
  },
  {
    id: 39,
    categoria: 'Invenções',
    texto:
      'O Projeto Gutenberg, iniciado em 1971 por Michael Hart, é a biblioteca digital mais antiga do mundo e oferece dezenas de milhares de livros em domínio público.',
  },
  {
    id: 40,
    categoria: 'Invenções',
    texto:
      'Os dados dos livros do Alexandria vêm da Open Library, um projeto que quer ter uma página para cada livro já publicado.',
  },

  // Recordes
  {
    id: 41,
    categoria: 'Recordes',
    texto:
      'A Biblioteca do Congresso, nos Estados Unidos, é a maior do mundo, com mais de 170 milhões de itens no acervo.',
  },
  {
    id: 42,
    categoria: 'Recordes',
    texto:
      'O livro impresso mais antigo com data conhecida é o Sutra do Diamante, da China, do ano 868.',
  },
  {
    id: 43,
    categoria: 'Recordes',
    texto: 'A Bíblia é considerada o livro mais vendido e mais traduzido da história.',
  },
  {
    id: 44,
    categoria: 'Recordes',
    texto:
      '"Em Busca do Tempo Perdido", de Marcel Proust, está entre os romances mais longos já publicados, com mais de 1 milhão de palavras.',
  },
  {
    id: 45,
    categoria: 'Recordes',
    texto:
      'Harry Potter é a série de livros mais vendida da história, com mais de 500 milhões de exemplares pelo mundo.',
  },
  {
    id: 46,
    categoria: 'Recordes',
    texto:
      'A Biblioteca Bodleiana, em Oxford, abriu ao público em 1602 e é uma das mais antigas da Europa ainda em funcionamento.',
  },

  // Bibliotecas
  {
    id: 47,
    categoria: 'Bibliotecas',
    texto:
      'A biblioteca do Trinity College, em Dublin, guarda o Livro de Kells, um manuscrito ilustrado feito por monges por volta do ano 800.',
  },
  {
    id: 48,
    categoria: 'Bibliotecas',
    texto:
      'O Real Gabinete Português de Leitura, no Rio de Janeiro, reúne o maior acervo de obras portuguesas fora de Portugal.',
  },
  {
    id: 49,
    categoria: 'Bibliotecas',
    texto:
      'A Biblioteca Mário de Andrade, em São Paulo, é a segunda maior biblioteca pública do Brasil, atrás só da Biblioteca Nacional.',
  },
  {
    id: 50,
    categoria: 'Bibliotecas',
    texto:
      'A Oodi, biblioteca central de Helsinque, na Finlândia, foi eleita a melhor biblioteca pública do mundo em 2019 pela IFLA.',
  },
  {
    id: 51,
    categoria: 'Bibliotecas',
    texto:
      'Na Human Library, criada na Dinamarca em 2000, você "pega emprestada" uma pessoa para ouvir a história dela.',
  },
  {
    id: 52,
    categoria: 'Bibliotecas',
    texto:
      'A Classificação Decimal de Dewey, criada em 1876, organiza os livros por assunto com números e ainda é usada em bibliotecas do mundo todo.',
  },
];

/** Sorteia outra curiosidade da lista, sem repetir a que está na tela. */
export function sortearOutra(
  lista: readonly Curiosidade[],
  atualId: number | null,
  aleatorio: () => number = Math.random,
): Curiosidade | null {
  const opcoes = lista.filter((item) => item.id !== atualId);
  if (!opcoes.length) return lista[0] ?? null;
  return opcoes[Math.floor(aleatorio() * opcoes.length)] ?? opcoes[0];
}
