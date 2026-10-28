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
- Edição de perfil ainda não existe no backend. O acesso à antiga rota vazia foi
  removido; a tela de perfil nesta etapa apenas consulta dados e permite sair.

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
