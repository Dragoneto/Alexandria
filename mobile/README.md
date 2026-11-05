# Alexandria Mobile

Versão mobile do Alexandria — uma biblioteca pessoal para descobrir, organizar e lembrar livros.

Construído com Expo (SDK 57) e React Native.

## Preparar o ambiente

Execute os comandos dentro de `mobile/`:

```sh
npm ci
```

O app lê `EXPO_PUBLIC_API_URL` em um só lugar, `src/constants/env.ts`, e o
endereço vem de arquivos de ambiente versionados. Trocar de backend não exige
editar código:

| Comando | Arquivo lido | Aponta para |
| --- | --- | --- |
| `npm start` | `.env.development` | backend local, `http://localhost:3000` |
| `npm run start:railway` | `.env.production` | backend publicado no Railway |

O link do Railway fica em `.env.production`, sem `/api` no final. Enquanto ele
estiver vazio, `npm run start:railway` avisa e não sobe o app.

Precisa de um endereço só seu, como o IP do computador para abrir no celular?
Copie `.env.example` para `.env.local` e ajuste a URL. Esse arquivo vence os
versionados, não entra no git e não interfere no `npm run start:railway`.

| Ambiente | Backend local |
| --- | --- |
| Navegador ou simulador iOS | `http://localhost:3000` |
| Emulador Android | `http://10.0.2.2:3000` |
| Celular físico | `http://IP-DO-COMPUTADOR:3000` |

`EXPO_PUBLIC_API_TIMEOUT` configura o limite de espera, em milissegundos; o padrão
é 15000. Depois de mudar qualquer variável basta reiniciar o Expo: o cache do
Metro não guarda esses valores.

Não há fallback de URL nem sessão de demonstração. A Open Library não usa essa
URL do backend: sua integração consulta diretamente a API pública oficial.

## Busca de livros

A tela Explorar consulta `https://openlibrary.org/search.json` e solicita somente
os campos usados pelo aplicativo. A busca aceita título, autor ou assunto, recebe
o termo vindo da Home, permite categoria e ordenação, exibe capas pelo Covers API
e carrega mais resultados em páginas de dez obras.

As buscas anteriores são canceladas quando termo ou filtro muda. O serviço limita
cada página a vinte itens, aplica timeout e valida a resposta antes de entregar
os livros à tela. O filtro “Com capa” remove resultados sem capa ou autoria. O link
“Ver na Open Library” oferece a atribuição e abre a página original da obra.

Essa API é pública e voltada a consultas humanas em baixo volume. Não use este
fluxo para importar o catálogo em massa. Biblioteca e favoritos continuam fora
desta integração e serão conectados ao backend em outra etapa.

## Backend e contratos

Em `backend/`, instale as dependências com `npm ci`, copie `.env.example` para
`.env` e configure um PostgreSQL local e um `JWT_SECRET` próprio. Execute o SQL
de `src/database/init.sql` no banco de desenvolvimento antes de `npm start`.

| Serviço | Endpoint | Contrato |
| --- | --- | --- |
| `registerUser()` | `POST /api/auth/register` | Envia `nome`, `email`, `senha`; recebe `{ user }`. |
| `loginUser()` | `POST /api/auth/login` | Envia `email`, `senha`; recebe `{ token, user }`. |
| `getProfile()` | `GET /api/auth/profile` | Envia Bearer token; recebe `{ user }`. |
| `forgotPassword()` | `POST /api/auth/forgot-password` | Envia `email`; espera `{ message }`. |
| `resetPassword()` | `POST /api/auth/reset-password` | Envia `token`, `senha`; espera `{ message }`. |
| `changePassword()` | `PUT /api/auth/password` | Envia Bearer token, `senhaAtual`, `novaSenha`; espera `{ message }`. |

O serviço converte `user.nome` em `name` para as telas. Cadastro não autentica:
o usuário confirma o popup e faz login. Todos os detalhes HTTP ficam em
`src/services/api.ts`, incluindo timeout, JSON, autenticação e erros nos formatos
`{ error }` ou `{ message, errors }`.

A recuperação de senha responde sempre a mesma mensagem, para não revelar quem
tem conta. Como ainda não há envio de e-mail, fora de produção o backend devolve
`resetToken` e `resetUrl` na resposta e registra o link no próprio log. Esse link
abre `alexandriamobile://redefinir-senha?token=...` no aparelho e
`/redefinir-senha?token=...` no navegador. O token vale 30 minutos, serve uma vez
só e é guardado com hash. O `mock-api/` reproduz as duas rotas para mexer no app
sem subir o backend (`npm run mock-api`).

Comentários nas avaliações (`src/services/comentarios.ts`), todos com Bearer token:

| Serviço | Endpoint | Contrato |
| --- | --- | --- |
| `listarComentarios()` | `GET /api/avaliacoes/:id/comentarios` | Recebe `{ comentarios }` em ordem de criação, removidos incluídos. |
| `listarPaginaComentarios()` | `GET /api/avaliacoes/:id/comentarios?limite&cursor&paiId` | Sem `paiId` traz comentários principais; com `paiId`, as respostas diretas dele. Limite padrão 20 e máximo 50. Recebe `{ comentarios, pai, proximoCursor, temMais }`, e cada comentário traz o total de `respostas`. |
| `comentar()`, `responder()` | `POST /api/avaliacoes/:id/comentarios` | Envia `texto` e, na resposta, `paiId`; recebe 201 `{ comentario }`. O último parâmetro, opcional, vira o header `Idempotency-Key`. |
| `editarComentario()` | `PUT /api/comentarios/:id` | Envia `texto` e a `versao` que a pessoa estava vendo; recebe `{ comentario }` com a versão nova. Só o autor edita, e o pai e a avaliação não mudam. |
| `excluirComentario()` | `DELETE /api/comentarios/:id` | Soft delete: recebe `{ comentario }` com `removido: true` e `texto: null`; as respostas continuam. |

Cada comentário vem como `{ id, avaliacaoId, paiId, autor: { id, nome }, texto,
removido, criadoEm, atualizadoEm, versao, podeEditar, podeExcluir }`. O autor sai do
token (o corpo não escolhe autor nem avaliação) e nunca leva e-mail nem foto.
O texto é obrigatório, com até 2.000 caracteres, e o `paiId` precisa ser de um
comentário da mesma avaliação. Erros: 400 validação (`{ error, errors: { texto } }`),
401 sessão, 403 comentário de outra pessoa, 404 avaliação ou comentário inexistente
e 409 comentário removido (editar, excluir de novo ou responder).

Para o reenvio não duplicar a mensagem, o envio de comentário ou resposta aceita o
header `Idempotency-Key`: uma key nova para cada mensagem (16 a 100 caracteres entre
letras sem acento, números, `-` e `_`; um UUID serve), repetida a cada nova tentativa
da mesma mensagem. Se a avaliação, o `paiId` ou o texto mudar antes de tentar de novo,
é outra mensagem e leva outra key. A mesma key com a mesma mensagem devolve 201 com o
comentário já gravado, como ele está agora, mesmo que o pai tenha sido removido depois.
Com outra mensagem, devolve 409, o que só acontece se o app reaproveitar a key. Key
fora do formato dá 400. A key vale só para quem enviou e é esquecida depois de 24 horas.
Sem o header, cada envio grava um comentário novo. `comentar()` e `responder()`
recebem a key como último parâmetro; `novaChaveDeEnvio()` gera uma no formato aceito.
Para isso `apiRequest` aceita `headers` extras, que não substituem os de
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

Avaliações (`src/services/avaliacoes.ts`), todas com Bearer token:

| Serviço | Endpoint | Contrato |
| --- | --- | --- |
| `criarAvaliacao()` | `POST /api/avaliacoes` | Envia `livroId`, `nota` (1 a 5) e `resenha` (10 a 5.000 caracteres); recebe 201 `{ avaliacao }`. 409 se a pessoa já avaliou o livro, com o `avaliacaoId` existente. |
| `listarAvaliacoesDoLivro()` | `GET /api/avaliacoes/livro/:livroId?page=` | Recebe `{ avaliacoes, total, media, page, hasMore }`, dez por página; cada item traz `usuarioNome` e `minha`. |
| `buscarAvaliacao()` | `GET /api/avaliacoes/:id` | Recebe `{ avaliacao }`; qualquer pessoa logada lê. |
| `atualizarAvaliacao()` | `PUT /api/avaliacoes/:id` | Envia `nota` e `resenha`; recebe `{ avaliacao }`. Só o autor altera (403). |
| `listarMinhasAvaliacoes()` | `GET /api/avaliacoes/minhas` | Recebe `{ avaliacoes }` da pessoa logada. |
| `excluirAvaliacao()` | `DELETE /api/avaliacoes/:id` | Só o autor exclui; 404 se já não existe. |

Biblioteca (`src/services/biblioteca.ts`), todas com Bearer token. Os status são
`QUERO_LER`, `LENDO`, `LIDO` e `ABANDONADO`:

| Serviço | Endpoint | Contrato |
| --- | --- | --- |
| `listarBiblioteca()` | `GET /api/biblioteca?status=` | Recebe `{ itens }`; o filtro por status é opcional. |
| `adicionarNaBiblioteca()` | `POST /api/biblioteca` | Envia `livroId` e `status` (padrão `QUERO_LER`); recebe 201 `{ item }`. 409 se o livro já está na biblioteca. |
| `atualizarItemBiblioteca()` | `PATCH /api/biblioteca/:id` | Envia `status` e/ou `favorito`; recebe `{ item }`. 400 sem nenhum dos dois. |
| `removerDaBiblioteca()` | `DELETE /api/biblioteca/:id` | Remove o item; 404 se já tinha saído. |

Na aba Biblioteca, a busca por título ou autor (sem diferenciar acento e
maiúscula), os filtros de status e o de favoritos são feitos no app, sobre a lista
já carregada (`filtrarBiblioteca()`). Tocar no livro abre o detalhe, onde o status
também pode ser consultado e trocado. Trocas de status atualizam a tela na hora e
voltam ao valor anterior se o servidor recusar.

Para uma edição antiga não sobrescrever a mais nova, cada comentário tem uma `versao`,
que começa em 1 e sobe a cada edição. `editarComentario()` manda a versão que a pessoa
estava vendo. Se o comentário mudou depois, por exemplo em outra sessão do mesmo autor,
o backend não grava e devolve 409 com `errors.versao` e o `comentario` atual no corpo, e
`classificarFalhaComentario()` devolve `'conflito'`. Nesse caso, a tela de comentários
(#130) deve manter o texto digitado, recarregar a conversa para mostrar a versão atual
e, quando a pessoa confirmar, tentar de novo com a versão nova. Versão faltando ou
inválida dá 400. Se o comentário foi removido durante a edição, vem o 409 de comentário
removido, e a tela não deve recriar o comentário com o texto digitado.

### Alterar senha

`PUT /api/auth/password` troca a senha de quem está logado, informando a atual. A
conta vem só da sessão: `id` ou `email` enviados no corpo são ignorados. A nova
senha segue a mesma regra do cadastro, e só o hash é gravado. `PUT /api/auth/profile`
nunca altera a senha, mesmo que receba campos com esse nome.

| Status | Quando | Corpo |
| --- | --- | --- |
| 200 | Senha trocada | `{ message }` |
| 400 | Campo ausente, tipo inválido, nova senha fora da regra ou senha atual incorreta | `{ error, errors }`, com `errors.senhaAtual` e/ou `errors.novaSenha` |
| 401 | Token ausente, inválido ou expirado, ou conta que não existe mais | `{ error }` |
| 404 | Conta apagada durante a troca | `{ error }` |

Senha atual incorreta é 400 de propósito: no app, todo 401 apaga a sessão do
aparelho, e errar a senha não pode deslogar ninguém.

**As sessões já emitidas continuam valendo.** O backend não revoga JWT: depois da
troca, todo token já emitido, neste aparelho ou em outro, segue aceito até expirar
(7 dias depois de emitido). `changePassword()` mantém a sessão deste aparelho e não
gera token novo. Por isso, nenhuma tela deve dizer que outros aparelhos foram
desconectados, e apagar o token do aparelho não conta como revogação.

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
- Edição de perfil ainda não existe no backend. O acesso à antiga rota vazia foi
  removido; a tela de perfil nesta etapa apenas consulta dados e permite sair.

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
7. Pedir o link em Esqueci a senha, copiar o token do log do backend, abrir
   `/redefinir-senha?token=...`, criar a nova senha e entrar com ela. Conferir
   que o mesmo link não funciona uma segunda vez. Só considerar o fluxo completo
   quando houver entrega real de e-mail.

## Erro em `expo/tsconfig.base`

Esse arquivo vem do pacote `expo` instalado em `mobile/node_modules`. Instale
as dependências em `mobile/` antes de executar o TypeScript. Para diagnóstico:

```sh
node -p "require.resolve('expo/tsconfig.base')"
npm run typecheck
```

Se a linha de comando passar e o editor continuar indicando erro, confira qual
pasta está aberta e qual instalação de TypeScript o editor está usando. Não
copie o arquivo-base para o repositório nem remova o `extends` para ocultar o aviso.
