// Perguntas da Central de ajuda. As respostas descrevem o app como ele é hoje:
// ao mudar uma tela, confira se a resposta correspondente continua certa.

export type Rota =
  | '/alterar-senha'
  | '/editar_perfil'
  | '/explore'
  | '/biblioteca'
  | '/perfil'
  | '/notificacoes'
  | '/minhas-avaliacoes';

export type Pergunta = {
  pergunta: string;
  resposta: string;
  /** Botão que leva direto à tela de que a resposta fala. */
  acao?: { rotulo: string; rota: Rota };
};

export type Assunto =
  | 'Conta'
  | 'Livros e busca'
  | 'Minha biblioteca'
  | 'Tracker de leitura'
  | 'Avaliações e conversas'
  | 'Problemas comuns';

export type Secao = { assunto: Assunto; perguntas: Pergunta[] };

export const FAQ: Secao[] = [
  {
    assunto: 'Conta',
    perguntas: [
      {
        pergunta: 'Como eu crio uma conta?',
        resposta:
          'Na tela inicial, toque em "Começar agora". Preencha nome, e-mail e senha, confirme a senha e toque em "Criar conta". Depois é só entrar com o e-mail e a senha.',
      },
      {
        pergunta: 'Como edito meu perfil?',
        resposta:
          'Na aba Perfil, toque em "Editar perfil". Altere seu nome ou e-mail e toque em "Salvar alterações".',
        acao: { rotulo: 'Editar perfil', rota: '/editar_perfil' },
      },
      {
        pergunta: 'Como coloco uma foto no perfil?',
        resposta:
          'Na aba Perfil, toque em "Adicionar foto" logo abaixo do círculo com a sua inicial e escolha uma imagem. Para tirar, use "Remover foto".',
      },
      {
        pergunta: 'Esqueci minha senha. E agora?',
        resposta:
          'Na tela de login, toque em "Esqueci minha senha" e digite seu e-mail. Você vai receber um código. Depois, toque em "Já tenho o código" e crie uma nova senha.',
      },
      {
        pergunta: 'Como troco minha senha?',
        resposta:
          'Na aba Perfil, toque em "Configurações" e depois em "Alterar senha". Confirme a senha atual e escolha a nova. Você continua conectado neste aparelho.',
        acao: { rotulo: 'Alterar senha', rota: '/alterar-senha' },
      },
      {
        pergunta: 'Como saio da minha conta?',
        resposta: 'Na aba Perfil, toque em "Configurações" e depois em "Sair da conta".',
      },
      {
        pergunta: 'Posso excluir minha conta?',
        resposta:
          'Ainda não dá para excluir a conta pelo próprio app. Se precisar, fale com a equipe que criou o Alexandria.',
      },
    ],
  },
  {
    assunto: 'Livros e busca',
    perguntas: [
      {
        pergunta: 'Como encontro um livro?',
        resposta:
          'Use a busca da aba Início ou abra a aba Explorar. Digite o título ou o nome do autor, por exemplo "Machado de Assis", ou toque numa categoria. Os filtros refinam o resultado.',
        acao: { rotulo: 'Abrir Explorar', rota: '/explore' },
      },
      {
        pergunta: 'De onde vêm as informações dos livros?',
        resposta:
          'Títulos, autores, capas, sinopses e número de páginas vêm da Open Library, um catálogo aberto e gratuito de livros do mundo todo.',
      },
      {
        pergunta: 'Por que alguns livros aparecem em inglês?',
        resposta:
          'O catálogo da Open Library é mundial. O app traduz títulos, categorias e sinopses quando consegue; quando uma sinopse foi traduzida automaticamente, a página do livro avisa.',
      },
      {
        pergunta: 'Por que um livro está sem capa?',
        resposta:
          'Nem toda edição tem capa na Open Library. No Explorar, toque em "Mais filtros" e escolha a qualidade "Com capa" para ver só livros com capa e autoria.',
      },
      {
        pergunta: 'O que são as estantes da aba Início?',
        resposta:
          'São seleções sorteadas por categoria e autor. Elas mudam a cada visita; puxe a tela para baixo para sortear outras na hora.',
      },
    ],
  },
  {
    assunto: 'Minha biblioteca',
    perguntas: [
      {
        pergunta: 'Como organizo minha estante?',
        resposta:
          'Na página de um livro, toque em "Adicionar à biblioteca". Cada livro tem um status: "Quero ler", "Lendo", "Lido" ou "Abandonado". Toque no status para trocar.',
        acao: { rotulo: 'Abrir minha biblioteca', rota: '/biblioteca' },
      },
      {
        pergunta: 'Posso ver só os livros que estou lendo?',
        resposta:
          'Sim. No topo da aba Biblioteca há um filtro para cada status, com a quantidade de livros em cada um. Também dá para buscar por título ou autor.',
      },
      {
        pergunta: 'Como marco um livro como favorito?',
        resposta:
          'Na aba Biblioteca, toque em "Favoritar" no cartão do livro. O filtro "Favoritos" mostra só eles.',
      },
      {
        pergunta: 'Como tiro um livro da biblioteca?',
        resposta:
          'Toque em "Remover" no cartão do livro e confirme. Se ele estiver em "Lendo", o progresso anotado também sai.',
      },
    ],
  },
  {
    assunto: 'Tracker de leitura',
    perguntas: [
      {
        pergunta: 'O que é o tracker de leitura?',
        resposta:
          'É o quadro no seu perfil com as páginas lidas, os dias de leitura, os livros lidos e as avaliações, além da barra de progresso de cada livro em "Lendo".',
        acao: { rotulo: 'Ver meu tracker', rota: '/perfil' },
      },
      {
        pergunta: 'Como os dias de leitura são contados?',
        resposta:
          'Cada dia em que você abre o app soma 1 dia aos livros que estão em "Lendo". Abrir várias vezes no mesmo dia conta uma vez só.',
      },
      {
        pergunta: 'Como anoto a página em que estou?',
        resposta:
          'Ao marcar um livro como "Lendo", o app pergunta a página. Depois, toque em "Atualizar progresso" no cartão do livro na Biblioteca ou na página do livro.',
      },
      {
        pergunta: 'De onde vem o número de páginas?',
        resposta:
          'Da Open Library, que calcula a média das edições do livro. Se a sua edição for diferente, troque o total no pop-up de progresso.',
      },
      {
        pergunta: 'O que acontece quando termino um livro?',
        resposta:
          'Marque o livro como "Lido": as páginas dele entram inteiras no total do perfil e ele sai da lista de livros em andamento.',
      },
    ],
  },
  {
    assunto: 'Avaliações e conversas',
    perguntas: [
      {
        pergunta: 'Como avalio um livro?',
        resposta:
          'Na página do livro, toque em "Avaliar este livro", escolha uma nota de 1 a 5 e escreva uma resenha de pelo menos 10 caracteres.',
      },
      {
        pergunta: 'Posso editar ou excluir minha avaliação?',
        resposta:
          'Sim. Em Perfil, toque em "Minhas avaliações" para editar ou excluir. Na página do livro também aparece "Editar minha avaliação".',
        acao: { rotulo: 'Minhas avaliações', rota: '/minhas-avaliacoes' },
      },
      {
        pergunta: 'Como comento na avaliação de outra pessoa?',
        resposta:
          'Na página do livro, abra a conversa de uma avaliação e escreva seu comentário. Para responder alguém, toque em "Responder" no comentário.',
      },
      {
        pergunta: 'Como sei quando alguém me respondeu?',
        resposta:
          'O sino da aba Início mostra quantas notificações não foram lidas. Toque nele para ver quem comentou ou respondeu e abrir a conversa.',
        acao: { rotulo: 'Ver notificações', rota: '/notificacoes' },
      },
      {
        pergunta: 'Posso editar ou apagar um comentário?',
        resposta:
          'Sim, os seus. Toque em "Editar" ou "Excluir" no comentário. Comentários editados ganham a marca "editado".',
      },
    ],
  },
  {
    assunto: 'Problemas comuns',
    perguntas: [
      {
        pergunta: 'O app demorou para abrir. É normal?',
        resposta:
          'Pode ser. O servidor do Alexandria descansa quando fica parado, e o primeiro acesso do dia pode levar até um minuto. Se demorar, o app avisa que o servidor está acordando.',
      },
      {
        pergunta: 'A busca não encontrou o livro que eu queria.',
        resposta:
          'Tente o nome do autor, o título original ou menos palavras. No Explorar, em "Mais filtros", a qualidade "Amplos" mostra todos os resultados válidos.',
      },
      {
        pergunta: 'Apareceu "Não foi possível conectar". O que faço?',
        resposta:
          'Confira sua internet e toque em "Tentar novamente". Se continuar, espere alguns instantes: o servidor pode estar acordando.',
      },
    ],
  },
];

/** As perguntas mais procuradas, mostradas no topo quando não há busca. */
export const MAIS_PROCURADAS = [
  'Como os dias de leitura são contados?',
  'Esqueci minha senha. E agora?',
  'Como organizo minha estante?',
  'O app demorou para abrir. É normal?',
];

function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const LETRA = /[a-z0-9]/;

/**
 * Posições em que o termo aparece no começo de uma palavra (assim "senha" não acha "resenha").
 * O texto já deve estar sem acento e em minúsculas.
 */
function inicios(normalizado: string, busca: string): number[] {
  const achados: number[] = [];
  let posicao = normalizado.indexOf(busca);
  while (posicao >= 0) {
    if (posicao === 0 || !LETRA.test(normalizado[posicao - 1])) achados.push(posicao);
    posicao = normalizado.indexOf(busca, posicao + 1);
  }
  return achados;
}

/** Filtra por assunto e por termo, ignorando acentos e maiúsculas. */
export function filtrarFaq(faq: Secao[], termo: string, assunto: Assunto | null): Secao[] {
  const busca = semAcento(termo.trim());
  return faq
    .filter((secao) => assunto === null || secao.assunto === assunto)
    .map((secao) => ({
      ...secao,
      perguntas: secao.perguntas.filter(
        (item) =>
          !busca || inicios(semAcento(`${item.pergunta} ${item.resposta}`), busca).length > 0,
      ),
    }))
    .filter((secao) => secao.perguntas.length > 0);
}

/**
 * Divide o texto em partes, marcando as que batem com o termo (sem diferenciar acentos),
 * para a tela destacar o que foi buscado mantendo a grafia original.
 */
export function partesDestacadas(
  texto: string,
  termo: string,
): { texto: string; destaque: boolean }[] {
  const busca = semAcento(termo.trim());
  if (!busca) return [{ texto, destaque: false }];
  // Cada letra sem acento continua na mesma posição do texto original.
  const normalizado = Array.from(texto, (letra) => semAcento(letra).charAt(0) || letra).join('');
  const partes: { texto: string; destaque: boolean }[] = [];
  let inicio = 0;
  for (const achou of inicios(normalizado.toLowerCase(), busca)) {
    if (achou < inicio) continue;
    if (achou > inicio) partes.push({ texto: texto.slice(inicio, achou), destaque: false });
    partes.push({ texto: texto.slice(achou, achou + busca.length), destaque: true });
    inicio = achou + busca.length;
  }
  if (inicio < texto.length) partes.push({ texto: texto.slice(inicio), destaque: false });
  return partes;
}
