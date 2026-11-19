# Alexandria Mobile

Versão mobile do Alexandria — uma biblioteca pessoal para descobrir, organizar e lembrar livros.

Construído com Expo (SDK 58) e React Native.

## Preparar o ambiente

Para instalar, configurar o endereço da API e rodar o app com o backend local, siga o
[guia de configuração e execução local](../README.md). Lá também estão os problemas
comuns, como API fora do ar, URL errada e o erro em `expo/tsconfig.base`.

O app lê `EXPO_PUBLIC_API_URL` em um só lugar, `src/constants/env.ts`, e o
endereço vem de arquivos de ambiente versionados. Trocar de backend não exige
editar código:

| Comando | Arquivo lido | Aponta para |
| --- | --- | --- |
| `npm start` | `.env.development` | backend local, `http://localhost:3000` |
| `npm run start:prod` | `.env.production` | backend publicado no Render |

O link do backend publicado fica em `.env.production`, sem `/api` no final. Enquanto ele
estiver vazio, `npm run start:prod` avisa e não sobe o app.

Para gerar uma versão e saber qual versão é cada build, veja o
[guia de build e publicação](docs/build-e-publicacao.md).

Para usar outro endereço, como o IP do computador no celular, crie um `.env.local`;
os endereços de cada ambiente estão no [guia](../README.md#o-endereço-da-api).

Não há fallback de URL nem sessão de demonstração. A busca de livros usa o
backend Alexandria, que consulta a API pública da Open Library.

## Busca de livros

A tela Explorar chama `GET /api/books/search` no backend, que consulta a Open
Library e solicita somente os campos usados pelo aplicativo. A busca aceita
título, autor ou assunto, recebe o termo vindo da Home, permite categoria e
ordenação, exibe capas pelo Covers API e carrega mais resultados em páginas de
dez obras. O detalhe chama `GET /api/books/:id`.

As buscas anteriores são canceladas quando termo ou filtro muda. O serviço limita
cada página a vinte itens, aplica timeout e valida a resposta antes de entregar
os livros à tela. O filtro “Com capa” remove resultados sem capa ou autoria. O link
“Ver na Open Library” oferece a atribuição e abre a página original da obra.

Essa API é pública e voltada a consultas humanas em baixo volume. Não use esse
fluxo para importar o catálogo em massa. Biblioteca e favoritos são recursos
próprios do Alexandria, persistidos pelo backend e separados do catálogo da
Open Library.

### Categorias e sinopses em português

O detalhe do livro recebe as categorias e a sinopse da Open Library pelo backend.
O backend traduz os textos para português brasileiro sob demanda ao abrir o
detalhe. Categorias conhecidas têm um mapeamento local; as demais e a sinopse
usam a API HTTP do DeepL quando `DEEPL_AUTH_KEY` está configurada no ambiente do
backend. A chave nunca deve ser adicionada ao mobile, ao Git ou a arquivos
`EXPO_PUBLIC_*`.

A integração não adiciona SDK nem dependência ao mobile. Ela envia a sinopse e
até cinco categorias em uma chamada, aplica timeout e mantém até 300 resultados
em cache de memória por 24 horas. Sinopses acima de 10.000 caracteres não são
enviadas para tradução. Se a chave estiver ausente, o provedor falhar ou o limite
de tamanho for excedido, o detalhe continua funcionando, categorias conhecidas
usam a tradução local e os demais textos aparecem no idioma original com aviso na
tela.

Para ativar a tradução local, configure `DEEPL_AUTH_KEY` no `backend/.env`; para
produção, configure a mesma variável como segredo no Render. Chaves DeepL Free
com sufixo `:fx` usam `https://api-free.deepl.com`; outras chaves usam
`https://api.deepl.com` por padrão. `DEEPL_API_URL` permite substituir o endereço.

## Backend e contratos

Para subir o backend local, com arquivos JSON ou com PostgreSQL, veja o
[guia de configuração e execução local](../README.md#subir-o-backend).

Rotas, corpos, respostas e erros da API estão na
[documentação da API](../backend/docs/api.md). Mudança de contrato é feita lá, no
mesmo PR da mudança.

O serviço de autenticação converte `user.nome` em `name` para as telas. O cadastro
não abre sessão no app: mesmo com o token na resposta, o usuário confirma o popup e
faz login. Todos os detalhes HTTP ficam em `src/services/api.ts`, incluindo timeout,
JSON, autenticação e a leitura dos [erros](../backend/docs/api.md#erros).

A recuperação de senha é por código de 6 dígitos enviado por e-mail. Em Esqueci a
senha, a pessoa informa o e-mail; na tela seguinte, digita o código e a nova senha.
O backend responde sempre a mesma mensagem, para não revelar quem tem conta. No
desenvolvimento, sem e-mail configurado, `RESET_CODE_DEBUG=true` no `backend/.env`
mostra o código no terminal do backend. O `mock-api/` reproduz as duas rotas para
mexer no app sem subir o backend (`npm run mock-api`).

Comentários nas avaliações ficam em `src/services/comentarios.ts`; rotas, campos e
erros estão em [Comentários](../backend/docs/api.md#comentários), na documentação da
API. Para o reenvio não duplicar a mensagem, `comentar()` e `responder()` recebem a
`Idempotency-Key` como último parâmetro, e `novaChaveDeEnvio()` gera uma no formato
aceito. Para isso `apiRequest` aceita `headers` extras, que não substituem os de
autenticação.

### Conversa da avaliação

A tela `app/avaliacao/[id].tsx` abre pela lista de avaliações do livro e pelo
botão "Ver conversa" de Minhas avaliações. Ela busca a avaliação
(`GET /api/avaliacoes/:id`) e os comentários juntos e monta a árvore com
`montarConversa()`: cada resposta logo abaixo do pai, com "Resposta a" e recuo
limitado a três níveis. A atualização é só por HTTP, sem WebSocket: depois de
cada envio, ao voltar para a tela e pelo botão Atualizar. Cada mensagem ganha uma
`Idempotency-Key`, repetida nas novas tentativas enquanto o texto e o alvo forem
os mesmos; em falha, o texto fica no campo. Editar e excluir só aparecem com
`podeEditar`/`podeExcluir`. O rascunho fica só na memória da tela e some ao sair
da conta, porque a rota está entre as protegidas.

### Avaliações e biblioteca

Avaliações ficam em `src/services/avaliacoes.ts` e a biblioteca em
`src/services/biblioteca.ts`. Rotas, campos, limites e erros estão em
[Avaliações](../backend/docs/api.md#avaliações) e
[Biblioteca](../backend/docs/api.md#biblioteca), na documentação da API.

Na aba Biblioteca, a busca por título ou autor (sem diferenciar acento e
maiúscula), os filtros de status e o de favoritos são feitos no app, sobre a lista
já carregada (`filtrarBiblioteca()`). Tocar no livro abre o detalhe, onde o status
também pode ser consultado e trocado. Trocas de status atualizam a tela na hora e
voltam ao valor anterior se o servidor recusar.

`editarComentario()` manda a `versao` que a pessoa estava vendo. Quando o comentário
mudou depois (o [409 de versão](../backend/docs/api.md#409-de-versão-do-comentário)),
`classificarFalhaComentario()` devolve `'conflito'`. Na conversa da avaliação, o texto
digitado fica no campo, a conversa recarrega com a versão atual para a pessoa revisar,
e o próximo Salvar parte dessa versão; uma atualização da conversa sem conflito não troca
a versão da edição. Se o comentário foi removido durante a edição, vem o 409 de comentário
removido, e a tela volta para comentário novo com o rascunho de antes da edição, sem
recriar o comentário.

No [limite de comentários](../backend/docs/api.md#429-com-retry-after), o 429 com
`Retry-After`, o app mantém o rascunho, mostra a mensagem do backend
(`classificarFalhaComentario` devolve `'limite'`) e não reenvia sozinho.

### Alterar senha

`changePassword()` chama `PUT /api/auth/password`, que troca a senha de quem está
logado informando a atual. Corpo, respostas e erros estão na
[documentação da API](../backend/docs/api.md#put-apiauthpassword).

Senha atual incorreta é 400 de propósito: no app, todo 401 apaga a sessão do
aparelho, e errar a senha não pode deslogar ninguém.

**As sessões já emitidas continuam valendo.** O backend não revoga JWT: depois da
troca, todo token já emitido, neste aparelho ou em outro, segue aceito até expirar
(7 dias depois de emitido). `changePassword()` mantém a sessão deste aparelho e não
gera token novo. Por isso, nenhuma tela deve dizer que outros aparelhos foram
desconectados, e apagar o token do aparelho não conta como revogação.

## Gerar o APK

O `eas.json` tem dois perfis, e os dois já apontam para o backend publicado no Render:

| Perfil | Gera | Uso |
| --- | --- | --- |
| `preview` | `.apk` | instalar direto no celular e mandar para a banca |
| `production` | `.aab` | publicar na Google Play |

Na primeira vez, dentro de `mobile/`, entre na conta Expo e vincule o projeto
(o `eas init` grava o `projectId` no `app.json`; faça commit dele):

```bash
npx eas-cli@latest login
npx eas-cli@latest init
```

Depois, para gerar o APK:

```bash
npx eas-cli@latest build -p android --profile preview
```

Na primeira build, aceite gerar a keystore do Android. No fim aparece o link e o
QR code para baixar o APK, que também ficam em expo.dev, na aba Builds do projeto.

## Sessão e navegação

- Android/iOS: sessão armazenada em `expo-secure-store`.
- Web: `sessionStorage`, preservada ao recarregar a mesma aba e encerrada ao fechar
  a aba. É armazenamento acessível ao JavaScript; não equivale a cookie HttpOnly.
- Ao iniciar, a sessão é confirmada pelo endpoint de perfil antes de liberar as
  abas. Sem conexão, há opção de tentar novamente ou remover a sessão salva.
- Uma resposta 401 protegida remove a sessão correspondente. Uma resposta antiga
  não deve invalidar uma sessão nova. Sessões fictícias antigas são descartadas.
- Logout remove a sessão local e bloqueia as rotas internas, inclusive ao voltar.
  O backend atual não oferece revogação de JWT no servidor.
- Alterar a senha não encerra nenhuma sessão, nem neste aparelho nem em outros
  (ver [Alterar senha](#alterar-senha)).
- O Perfil mostra os dados da conta e a foto, que pode ser trocada ou removida ali
  mesmo. Editar perfil abre `src/app/editar_perfil.tsx`, que muda nome e e-mail;
  alterar a senha e sair da conta ficam em Configurações.

## Tema

As cores, o contraste e as regras para telas novas estão em [docs/tema.md](docs/tema.md).

## Acessibilidade

As regras para telas novas, o que foi verificado e as limitações estão em [docs/acessibilidade.md](docs/acessibilidade.md).

## Verificação

```sh
npm run typecheck
npm run lint
npm test
npx expo export --platform web
```

Os testes executam os serviços reais com respostas de rede e armazenamento
controlados. Cobrem contratos, erros, expiração, restauração e concorrência entre
logout e requisições. Não substituem teste visual em aparelho nem teste com
PostgreSQL e backend em execução.

A alteração de senha também tem testes de API em
`backend/tests/change-password.test.js`, que sobem o backend de verdade. Em
`backend/`, `npm test` os executa com o JSON local. Para executar a mesma suíte no
PostgreSQL, aponte `TEST_DATABASE_URL` para um banco descartável, porque as contas
de teste ficam nele. O SSL fica desligado, a menos que `DB_SSL` diga outra coisa:

```sh
TEST_DATABASE_URL=postgresql://usuario:senha@localhost:5432/banco_de_teste node --test tests/change-password.test.js
```

A persistência das conversas é verificada nos dois modos, com os mesmos cenários.
`npm run test:persistencia:pg` roda tudo em um PostgreSQL descartável, sem senha e
sem tocar no banco de desenvolvimento. Comandos, proteções, cobertura e limitações
estão em [backend/docs/testes-persistencia.md](../backend/docs/testes-persistencia.md).

Para validar de ponta a ponta em um ambiente de desenvolvimento:

1. Cadastrar uma conta de teste; confirmar o nome no popup e seguir para login.
2. Tentar senha incorreta: exibir erro e continuar sem acesso às abas.
3. Entrar com senha correta: abrir Home e consultar nome/e-mail no Perfil.
4. Reabrir o app/recarregar a aba: validar a sessão e manter o usuário conectado.
5. Sair da conta: voltar ao login e verificar que voltar/abrir uma URL interna
   não permite acessar as abas sem nova autenticação.
6. Verificar indisponibilidade de rede e token expirado; tentar novamente após
   restaurar a conexão.
7. Pedir o código em Esqueci a senha, pegar o código de 6 dígitos no e-mail (ou,
   com `RESET_CODE_DEBUG=true`, no terminal do backend), criar a nova senha e entrar
   com ela. Conferir que o mesmo código não funciona uma segunda vez.
