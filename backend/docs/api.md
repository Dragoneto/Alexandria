# Documentação da API

Contrato das rotas do backend do Alexandria, conferido no código de `backend/src`. O app mobile, a versão web e o backend seguem este documento. Mudou uma rota, um corpo, uma resposta ou um erro? Atualize este arquivo no mesmo PR da mudança.

Os exemplos usam pessoas e textos fictícios. Os livros são obras reais da Open Library, porque o detalhe do livro, a criação de avaliação e a biblioteca buscam a obra lá.

## Visão geral

- **Endereço:** no desenvolvimento, `http://localhost:3000` (a porta vem de `PORT`, no `backend/.env`). O endereço publicado fica em `mobile/.env.production`. Fora `GET /`, todas as rotas começam com `/api`.
- **Formato:** corpo e resposta em JSON. Mande `Content-Type: application/json`. O servidor lê até 1 MB por requisição.
- **Token:** nas rotas com token, mande `Authorization: Bearer <token>`. O token vem do cadastro ou do login e vale 7 dias. Não há logout nem revogação no servidor: um token vale até expirar, mesmo depois de trocar a senha.
- **Dono dos dados:** a conta é sempre a do token. Nenhuma rota usa id ou e-mail de usuário vindo no corpo para decidir de quem é o dado.
- **Ids:** livro é o id de obra da Open Library (`OL`, número e `W`, como `OL1003040W`). Avaliação, comentário e item da biblioteca são números inteiros. Notificação é UUID.
- **Datas:** texto ISO 8601 em UTC, como `2026-11-19T12:21:39.253Z`.
- **CORS:** `CORS_ORIGINS`, no `backend/.env`, lista as origens aceitas, separadas por vírgula. Vazio aceita qualquer origem.

## Erros

Todo erro das rotas vem em JSON, num destes dois formatos:

```json
{ "error": "Avaliação não encontrada" }
```

```json
{
  "error": "A nota deve ser um número inteiro de 1 a 5",
  "errors": {
    "nota": "A nota deve ser um número inteiro de 1 a 5",
    "resenha": "A resenha deve ter pelo menos 10 caracteres"
  }
}
```

O primeiro é o caso geral. O segundo é a validação por campo: cada chave de `errors` é um campo do corpo (`nota`, `resenha`, `texto`, `versao`, `senhaAtual` ou `novaSenha`), e `error` repete a primeira mensagem. As mensagens já estão em português e podem ir direto para a tela. Dois erros trazem um campo a mais, explicado na rota: `avaliacaoId` no 409 de avaliação repetida e `comentario` no 409 de versão do comentário.

Toda rota com token pode responder 401, e qualquer rota pode responder 500 `Erro interno do servidor`, sem detalhes da falha. As listas de erros de cada rota não repetem esses dois. JSON malformado no corpo dá 400 `O corpo da requisição não é um JSON válido` em qualquer rota.

| Status | Quando |
| --- | --- |
| 400 | Parâmetro, corpo ou JSON inválido |
| 401 | Sessão inválida (tabela abaixo) ou login com e-mail ou senha errados |
| 403 | Alterar avaliação ou comentário de outra pessoa |
| 404 | Recurso que não existe, ou rota inexistente (esta em HTML) |
| 409 | Conflito com o que já está gravado; cada rota diz qual |
| 410 | Contexto de um comentário removido |
| 413 | Corpo grande demais |
| 429 | Limite de comentários |
| 500 | Falha interna |
| 502 | A Open Library falhou ou respondeu algo inválido |
| 503 | Redefinição de senha sem e-mail configurado, ou health check sem banco |
| 504 | A Open Library demorou para responder |

### Sessão (401)

| Mensagem | Quando |
| --- | --- |
| `Token não fornecido` | Sem o header `Authorization` |
| `Token mal formatado` | Header sem o token depois do espaço |
| `Token inválido ou expirado` | Assinatura errada, token alterado ou vencido |
| `Sessão inválida. Entre novamente.` | Token válido de uma conta que não existe mais |

Se o banco falhar ao conferir a sessão, a resposta é 500, e não 401: o app apaga a sessão em todo 401, e uma queda do banco não deve tirar ninguém da conta.

### 409 de versão do comentário

Cada comentário tem uma `versao`, que começa em 1 e sobe a cada edição. Quem edita (`PUT /api/comentarios/:id`) manda a versão que estava vendo. Se o comentário mudou depois, por exemplo em outra sessão do mesmo autor, nada é gravado, e a resposta traz o comentário como está agora, para a pessoa revisar antes de salvar de novo:

```json
{
  "error": "Este comentário mudou desde que você abriu. Revise a versão atual antes de salvar de novo",
  "errors": {
    "versao": "Este comentário mudou desde que você abriu. Revise a versão atual antes de salvar de novo"
  },
  "comentario": {
    "id": 1,
    "avaliacaoId": 1,
    "paiId": null,
    "autor": { "id": 2, "nome": "Bruno Exemplo" },
    "texto": "Concordo muito com a resenha!",
    "removido": false,
    "criadoEm": "2026-11-19T12:21:39.318Z",
    "atualizadoEm": "2026-11-19T12:21:39.390Z",
    "versao": 2,
    "podeEditar": true,
    "podeExcluir": true
  }
}
```

A próxima tentativa parte da `versao` que veio nesse corpo. Versão ausente ou inválida dá 400 com `errors.versao`. Se o comentário foi removido durante a edição, o 409 é outro, só com `{ "error": "Este comentário foi removido" }`.

### 429 com Retry-After

Cada conta cria até 30 comentários ou respostas por minuto, numa janela deslizante. Ao passar do limite, a criação responde 429 com o header `Retry-After`, em segundos, liberado para o app web por `Access-Control-Expose-Headers`:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60
Access-Control-Expose-Headers: Retry-After
Content-Type: application/json; charset=utf-8

{ "error": "Você enviou muitos comentários em pouco tempo. Tente de novo em 60 segundos." }
```

- Os segundos são o que falta para o envio mais antigo da janela sair dela, e a mensagem usa o mesmo número.
- Conta toda tentativa de criação que passa pelo token, inclusive as que dão erro e os reenvios com a mesma `Idempotency-Key`. As recusadas com 429 não contam nem aumentam a espera.
- Só a criação tem limite. Editar e remover não contam.
- `COMENTARIOS_LIMITE` e `COMENTARIOS_JANELA_SEGUNDOS`, no `backend/.env`, mudam os números (padrão 30 e 60).
- A contagem fica na memória de cada processo do backend. Com mais de uma instância, cada uma conta separado, e o limite real pode chegar a N vezes o configurado.

### 413 de corpo grande

| Limite | Onde vale | Resposta |
| --- | --- | --- |
| Foto acima de 300 KB (307.200 caracteres do texto `data:`) | `PUT /api/auth/profile/photo` | 413 `{ "error": "A foto é grande demais" }` |
| Corpo acima de 32 KB | Criar e editar comentário | 413 `{ "error": "O corpo da requisição passou de 32 KB" }` |
| Corpo acima de 1 MB | Qualquer rota | 413 em HTML |

Os 32 KB do comentário são medidos pelo `Content-Length` ou, sem ele, pelo corpo lido. O limite de 1 MB é do `express.json()`, que roda antes das rotas e responde com a página de erro do Express (`PayloadTooLargeError`), e não com JSON. Uma foto ou um comentário acima de 1 MB também caem nesse caso. Sem `error` no corpo, o `apiRequest` do app monta a mensagem genérica `Não foi possível concluir a solicitação (HTTP 413).`

### Respostas fora do formato

- Rota inexistente: 404 em HTML, com o texto `Cannot GET /caminho` (ou o método usado). Em `/api/avaliacoes`, `/api/comentarios`, `/api/notificacoes` e `/api/biblioteca` o token é conferido antes da rota, então sem token válido a resposta é o 401 em JSON.
- Corpo acima de 1 MB: 413 em HTML, como acima.
- `GET /api/health` com o banco fora do ar: 503 em JSON, mas no formato `{ "status": "erro", "database": "postgres" }`, sem `error`.

Por isso o cliente deve olhar o status antes de tratar o corpo como `{ error }`, como já faz `mobile/src/services/api.ts`.

## Objetos

Formatos que se repetem nas respostas. Nos exemplos das rotas eles aparecem encurtados; na resposta real vêm completos.

### Usuário

```json
{ "id": 1, "nome": "Ana Exemplo", "email": "ana@example.com", "criado_em": "2026-11-19T12:21:36.684Z" }
```

`criado_em` vem em snake_case, diferente dos outros objetos. O login devolve só `id`, `nome` e `email`. Senha e foto nunca vêm no usuário; a foto tem rota própria, e a de outras pessoas não aparece em nenhuma rota.

### Livro

Na busca:

```json
{
  "id": "OL1003040W",
  "title": "Dom Casmurro",
  "originalTitle": "Dom Casmurro",
  "titleTranslated": false,
  "authors": ["Machado de Assis"],
  "categories": ["Fiction", "Adultery"],
  "categoriesTranslated": false,
  "category": "Catálogo geral",
  "coverUrl": "https://covers.openlibrary.org/b/id/647501-M.jpg?default=false",
  "firstPublishYear": 1899,
  "editionCount": 112,
  "languages": ["por", "eng"],
  "openLibraryUrl": "https://openlibrary.org/works/OL1003040W"
}
```

No detalhe:

```json
{
  "id": "OL1003040W",
  "title": "Dom Casmurro",
  "originalTitle": "Dom Casmurro",
  "titleTranslated": false,
  "authors": ["Machado de Assis"],
  "description": "Romance de Machado de Assis publicado em 1899.",
  "descriptionTranslated": false,
  "categories": ["Ficção", "Adultery"],
  "categoriesTranslated": false,
  "coverUrl": "https://covers.openlibrary.org/b/id/647501-L.jpg?default=false",
  "openLibraryUrl": "https://openlibrary.org/works/OL1003040W"
}
```

- `category`, só na busca, repete a categoria pedida, ou `Catálogo geral` sem filtro.
- `firstPublishYear` e `description` vêm `null` quando a Open Library não tem o dado. Sem capa, `coverUrl` vem `null`, ou com o endereço de `BOOK_COVER_PLACEHOLDER_URL` quando essa variável está definida no backend. A `capa` da avaliação e da biblioteca é esse mesmo valor, gravado quando o livro entrou.
- O backend traduz para o português o título (na busca e no detalhe), a sinopse e as categorias (só no detalhe). Categorias conhecidas têm tradução local; o resto usa o DeepL quando `DEEPL_AUTH_KEY` está configurada no backend. `titleTranslated` e `descriptionTranslated` dizem se o DeepL traduziu o campo, e `categoriesTranslated` só é `true` quando todas as categorias foram traduzidas. O título de origem fica em `originalTitle`.

### Avaliação

```json
{
  "id": 1,
  "usuarioId": 1,
  "livro": {
    "id": "OL1003040W",
    "titulo": "Dom Casmurro",
    "autores": ["Machado de Assis"],
    "capa": "https://covers.openlibrary.org/b/id/647501-L.jpg?default=false"
  },
  "nota": 5,
  "resenha": "Uma leitura muito boa, recomendo.",
  "criadoEm": "2026-11-19T12:21:39.253Z",
  "atualizadoEm": "2026-11-19T12:21:39.253Z"
}
```

Nas leituras (lista do livro, minhas avaliações e detalhe), cada avaliação traz também `usuarioNome`, o nome de quem avaliou (nunca o e-mail), e `minha`, que é `true` quando a avaliação é de quem fez a requisição. Criar e editar devolvem sem esses dois.

### Comentário

```json
{
  "id": 1,
  "avaliacaoId": 1,
  "paiId": null,
  "autor": { "id": 2, "nome": "Bruno Exemplo" },
  "texto": "Concordo com a resenha!",
  "removido": false,
  "criadoEm": "2026-11-19T12:21:39.318Z",
  "atualizadoEm": "2026-11-19T12:21:39.318Z",
  "versao": 1,
  "podeEditar": true,
  "podeExcluir": true
}
```

- `paiId` é `null` no comentário direto na avaliação; numa resposta, é o id do comentário respondido.
- `autor` traz só id e nome, nunca e-mail nem foto.
- `podeEditar` e `podeExcluir` valem para quem fez a requisição: `true` só para o autor, e `false` em comentário removido.
- Comentário removido continua nas listas com `removido: true` e `texto: null`, para as respostas não perderem o lugar.

### Notificação

```json
{
  "id": "6f1c2b9e-3d4a-4e8b-9c1d-2a3b4c5d6e7f",
  "tipo": "resposta",
  "autor": { "id": 1, "nome": "Ana Exemplo" },
  "avaliacaoId": 1,
  "comentarioId": 2,
  "eventoId": "0b7e4c2a-9f3d-4a1b-8c6e-5d4f3a2b1c0e",
  "livroTitulo": "Dom Casmurro",
  "criadoEm": "2026-11-19T12:21:39.358Z",
  "lidaEm": null,
  "alvoDisponivel": true
}
```

- `tipo` é `comentario` (comentaram na sua avaliação) ou `resposta` (responderam a um comentário seu).
- `autor` é quem escreveu. Se a conta não existe mais, o nome vem como `Leitor`.
- `eventoId` identifica o envio que gerou a notificação e serve para abrir o contexto do comentário.
- `alvoDisponivel` é `false` quando a avaliação ou o comentário não existem mais, ou o comentário foi removido. A notificação continua na lista, e `livroTitulo` vem `null` se a avaliação foi excluída.
- A notificação não traz o texto do comentário nem e-mail.

### Item da biblioteca

```json
{
  "id": 1,
  "statusLeitura": "LENDO",
  "favorito": true,
  "livro": {
    "id": "OL1003040W",
    "titulo": "Dom Casmurro",
    "autores": ["Machado de Assis"],
    "capa": "https://covers.openlibrary.org/b/id/647501-L.jpg?default=false"
  },
  "adicionadoEm": "2026-11-19T12:21:40.006Z",
  "progresso": {
    "paginaAtual": 120,
    "paginasTotal": 269,
    "diasLeitura": 3,
    "concluidoEm": null
  }
}
```

- `statusLeitura` é `QUERO_LER`, `LENDO`, `LIDO` ou `ABANDONADO`.
- `id` é do item, não do livro: é ele que vai no caminho de `PATCH` e `DELETE`.
- `paginasTotal` vem da Open Library e é `null` quando ela não informa; a pessoa pode corrigir pelo `PATCH`.
- `diasLeitura` conta o dia em que o livro entrou em `LENDO` e cada dia em que o app foi aberto com ele em `LENDO` (ver `POST /api/biblioteca/dia-de-leitura`).
- `concluidoEm` é preenchido ao passar para `LIDO` e volta a `null` ao sair de `LIDO`.

## Rotas

`Serviço no app` é a função de `mobile/src/services/` que chama a rota.

| Rota | Token | Serviço no app | O que faz |
| --- | --- | --- | --- |
| `GET /` | não | não usa | Diz se o processo está no ar |
| `GET /api/health` | não | não usa | Confere o banco |
| `POST /api/auth/register` | não | `registerUser()` | Cria a conta |
| `POST /api/auth/login` | não | `loginUser()` | Entra e recebe o token |
| `POST /api/auth/forgot-password` | não | `forgotPassword()` | Manda o código de redefinição por e-mail |
| `POST /api/auth/reset-password` | não | `resetPassword()` | Troca a senha com o código |
| `GET /api/auth/profile` | sim | `getProfile()` | Perfil e contagem da biblioteca |
| `PUT /api/auth/profile` | sim | `updateProfile()` | Edita nome e e-mail |
| `PUT /api/auth/password` | sim | `changePassword()` | Troca a senha informando a atual |
| `GET /api/auth/profile/photo` | sim | `getProfilePhoto()` | Lê a foto de perfil |
| `PUT /api/auth/profile/photo` | sim | `saveProfilePhoto()` | Grava a foto de perfil |
| `DELETE /api/auth/profile/photo` | sim | `removeProfilePhoto()` | Remove a foto de perfil |
| `GET /api/books/search` | sim | `searchBooks()` | Busca livros na Open Library |
| `GET /api/books/:id` | sim | `getBookDetail()` | Detalhe de um livro |
| `POST /api/avaliacoes` | sim | `criarAvaliacao()` | Avalia um livro |
| `GET /api/avaliacoes/livro/:livroId` | sim | `listarAvaliacoesDoLivro()` | Avaliações de um livro, com a média |
| `GET /api/avaliacoes/minhas` | sim | `listarMinhasAvaliacoes()` | Avaliações de quem está logado |
| `GET /api/avaliacoes/:id` | sim | `buscarAvaliacao()` | Uma avaliação |
| `PUT /api/avaliacoes/:id` | sim | `atualizarAvaliacao()` | Edita a própria avaliação |
| `DELETE /api/avaliacoes/:id` | sim | `excluirAvaliacao()` | Exclui a própria avaliação |
| `GET /api/avaliacoes/:id/comentarios` | sim | `listarComentarios()`, `listarPaginaComentarios()` | Comentários de uma avaliação |
| `POST /api/avaliacoes/:id/comentarios` | sim | `comentar()`, `responder()` | Comenta ou responde |
| `PUT /api/comentarios/:id` | sim | `editarComentario()` | Edita o próprio comentário |
| `DELETE /api/comentarios/:id` | sim | `excluirComentario()` | Remove o próprio comentário |
| `GET /api/avaliacoes/:id/comentarios/:comentarioId/contexto` | sim | `buscarContexto()` | Conversa em volta de um comentário |
| `GET /api/notificacoes` | sim | `listarNotificacoes()` | Notificações, das mais novas para as mais antigas |
| `GET /api/notificacoes/nao-lidas` | sim | `contarNaoLidas()` | Quantas não foram lidas |
| `PATCH /api/notificacoes/:id/lida` | sim | `marcarNotificacaoLida()` | Marca uma como lida |
| `PATCH /api/notificacoes/lidas` | sim | `marcarTodasNotificacoesLidas()` | Marca todas como lidas |
| `GET /api/biblioteca` | sim | `listarBiblioteca()` | Livros da biblioteca |
| `POST /api/biblioteca` | sim | `adicionarNaBiblioteca()` | Adiciona um livro |
| `PATCH /api/biblioteca/:id` | sim | `atualizarItemBiblioteca()` | Muda status, favorito ou progresso |
| `DELETE /api/biblioteca/:id` | sim | `removerDaBiblioteca()` | Tira um livro da biblioteca |
| `POST /api/biblioteca/dia-de-leitura` | sim | `registrarDiaDeLeitura()` | Conta o dia de leitura de hoje |
| `GET /api/biblioteca/dias-de-leitura` | sim | `buscarDiasDeLeitura()` | Total de dias de leitura |

## Saúde

### GET /

Diz que o processo está no ar, sem consultar o banco.

- **Token:** não.
- **Parâmetros e corpo:** nenhum.
- **Resposta 200:** `{ "message": "🏛️ Alexandria API está rodando!", "version": "1.0.0", "storage": "local-file" }`. `storage` é `local-file` (arquivos JSON locais) ou `postgres`.
- **Erros:** nenhum próprio.

### GET /api/health

Confere o banco com um `SELECT 1`.

- **Token:** não.
- **Parâmetros e corpo:** nenhum.
- **Resposta 200:** `{ "status": "ok", "database": "postgres" }`. No modo JSON local não há banco para consultar, e a resposta é `{ "status": "ok", "database": "local" }`.
- **Erros:** 503 `{ "status": "erro", "database": "postgres" }` quando o banco não responde. Esse corpo não segue o formato `{ error }`.

## Autenticação e perfil

A senha precisa ter pelo menos 8 caracteres, com letra e número, no cadastro, na redefinição e na troca. O e-mail é gravado sem espaços nas pontas e em minúsculas. O banco guarda só o hash da senha. No PostgreSQL, o nome cabe em 100 caracteres e o e-mail em 255; o backend ainda não confere esses tamanhos, e um texto maior dá 500 (no modo JSON local, é aceito).

### POST /api/auth/register

Cria a conta e já devolve um token.

- **Token:** não.
- **Corpo:** `{ "nome": "Ana Exemplo", "email": "ana@example.com", "senha": "exemplo123" }`, os três obrigatórios.
- **Resposta 201:**

```json
{
  "message": "Usuário cadastrado com sucesso!",
  "token": "<token>",
  "user": { "id": 1, "nome": "Ana Exemplo", "email": "ana@example.com", "criado_em": "2026-11-19T12:21:36.684Z" }
}
```

- **Erros:**
  - 400 `Todos os campos são obrigatórios (nome, email, senha)`
  - 400 `A senha precisa ter pelo menos 8 caracteres, com letra e número`
  - 409 `Este email já está cadastrado`

### POST /api/auth/login

Entra na conta e devolve um token novo.

- **Token:** não.
- **Corpo:** `{ "email": "ana@example.com", "senha": "exemplo123" }`
- **Resposta 200:**

```json
{
  "message": "Login realizado com sucesso!",
  "token": "<token>",
  "user": { "id": 1, "nome": "Ana Exemplo", "email": "ana@example.com" }
}
```

- **Erros:**
  - 400 `Email e senha são obrigatórios`
  - 401 `Email ou senha incorretos`, igual para e-mail sem conta e para senha errada.

### POST /api/auth/forgot-password

Pede um código de 6 dígitos para criar uma nova senha. A resposta é a mesma para e-mail com ou sem conta, para não revelar quem tem cadastro.

- **Token:** não.
- **Corpo:** `{ "email": "ana@example.com" }`
- **Resposta 200:** `{ "message": "Se existir uma conta com esse e-mail, enviamos um código de 6 dígitos para criar uma nova senha." }`
- O código vale `RESET_TOKEN_TTL_MINUTES` minutos (padrão 15) e vai por e-mail, pelo Brevo (`BREVO_API_KEY` e `MAIL_FROM`) ou por SMTP (`SMTP_USER` e `SMTP_PASS`). Pedir de novo invalida o código anterior.
- Só no desenvolvimento, com `RESET_CODE_DEBUG=true` no `backend/.env`, a resposta de uma conta que existe traz também `"resetCode": "123456"`, e o código aparece no log do backend. O backend não sobe com essa opção junto de `NODE_ENV=production`.
- **Erros:**
  - 400 `Email é obrigatório`
  - 503 `A redefinição de senha está indisponível no momento. Tente de novo mais tarde.`, quando não há e-mail configurado nem `RESET_CODE_DEBUG=true`.

### POST /api/auth/reset-password

Troca a senha usando o código recebido.

- **Token:** não.
- **Corpo:** `{ "email": "ana@example.com", "codigo": "123456", "senha": "exemplo456" }`
- Cada código aceita 5 tentativas; depois disso, nem o código certo passa. Depois de usado, o código deixa de valer.
- **Resposta 200:** `{ "message": "Senha redefinida com sucesso!" }`
- **Erros:**
  - 400 `Código inválido ou expirado. Peça um novo.`, para e-mail ou código faltando, código fora do formato, errado, vencido ou sem tentativas.
  - 400 `A senha precisa ter pelo menos 8 caracteres, com letra e número`

### GET /api/auth/profile

Devolve o perfil de quem está logado e quantos livros a pessoa tem em cada status da biblioteca.

- **Token:** sim. Só o próprio perfil.
- **Parâmetros e corpo:** nenhum.
- **Resposta 200:**

```json
{
  "user": { "id": 1, "nome": "Ana Exemplo", "email": "ana@example.com", "criado_em": "2026-11-19T12:21:36.684Z" },
  "estatisticas": { "QUERO_LER": 2, "LENDO": 1, "LIDO": 4, "ABANDONADO": 0 }
}
```

- **Erros:** 404 `Usuário não encontrado`.

### PUT /api/auth/profile

Edita o nome e o e-mail de quem está logado.

- **Token:** sim. Só o próprio perfil.
- **Corpo:** `{ "nome": "Ana Maria Exemplo", "email": "ana@example.com" }`, os dois obrigatórios. Esta rota nunca muda a senha, mesmo que receba um campo com esse nome.
- **Resposta 200:** `{ "message": "Perfil atualizado com sucesso!", "user": { "id": 1, "nome": "Ana Maria Exemplo", "email": "ana@example.com", "criado_em": "2026-11-19T12:21:36.684Z" } }`
- **Erros:**
  - 400 `Nome e email são obrigatórios`
  - 404 `Usuário não encontrado`
  - 409 `Este email já está cadastrado`, quando o e-mail é de outra conta.

### PUT /api/auth/password

Troca a senha de quem está logado, informando a atual.

- **Token:** sim. A conta vem só do token: `id` ou `email` no corpo são ignorados.
- **Corpo:** `{ "senhaAtual": "exemplo123", "novaSenha": "exemplo456" }`
- Os tokens já emitidos, neste aparelho ou em outros, continuam valendo até expirar.
- **Resposta 200:** `{ "message": "Senha alterada com sucesso!" }`
- **Erros:**
  - 400 com `errors.senhaAtual` e/ou `errors.novaSenha`: `Informe a senha atual`, `A senha atual precisa ser um texto`, `Informe a nova senha`, `A nova senha precisa ser um texto` ou a regra da senha.
  - 400 `A senha atual está incorreta`, também em `errors.senhaAtual`. É 400 de propósito, e não 401: no app, todo 401 encerra a sessão, e errar a senha não pode tirar ninguém da conta.
  - 404 `Usuário não encontrado`, se a conta for apagada durante a troca.

### GET /api/auth/profile/photo

Devolve a foto de perfil de quem está logado.

- **Token:** sim. Só a própria foto.
- **Parâmetros e corpo:** nenhum.
- **Resposta 200:** `{ "foto": null }` sem foto, ou `{ "foto": "data:image/jpeg;base64,/9j/4AAQSkZJRg==" }` (encurtado).
- **Erros:** 404 `Usuário não encontrado`.

### PUT /api/auth/profile/photo

Grava ou troca a foto de perfil.

- **Token:** sim. Só a própria foto.
- **Corpo:** `{ "foto": "data:image/jpeg;base64,/9j/4AAQSkZJRg==" }`: imagem JPG, PNG ou WebP em base64, no formato `data:`, com até 300 KB de texto (307.200 caracteres).
- **Resposta 200:** `{ "message": "Foto de perfil atualizada!", "foto": "data:image/jpeg;base64,/9j/4AAQSkZJRg==" }`
- **Erros:**
  - 400 `Envie uma imagem JPG, PNG ou WebP`
  - 404 `Usuário não encontrado`
  - 413 `A foto é grande demais` (ver [413 de corpo grande](#413-de-corpo-grande))

### DELETE /api/auth/profile/photo

Remove a foto de perfil.

- **Token:** sim. Só a própria foto.
- **Parâmetros e corpo:** nenhum.
- **Resposta 200:** `{ "message": "Foto de perfil removida!", "foto": null }`
- **Erros:** 404 `Usuário não encontrado`.

## Livros

As duas rotas consultam a Open Library na hora; o backend não guarda o catálogo. Qualquer pessoa logada pode usar.

### GET /api/books/search

Busca obras por título, autor ou assunto.

- **Token:** sim.
- **Parâmetros (query):**
  - `q`: termo, com pelo menos 2 caracteres. Pode ficar vazio quando vem `category`, e aí a busca lista os livros da categoria.
  - `category`: nome de uma categoria ou subcategoria em português, exatamente como em `backend/src/constants/categorias.js` (por exemplo `Ficção` ou `Brasil`). O app tem uma cópia em `mobile/src/constants/categorias.ts`, e um teste confere que as duas são iguais.
  - `order`: `newest` ordena pelos mais novos. Sem ele, vale a ordem da Open Library.
  - `page`: página, a partir de 1 (padrão 1).
  - `limit`: livros por página, de 1 a 20 (padrão 10). Acima de 20 vira 20.
- **Exemplo:** `GET /api/books/search?q=dom%20casmurro&limit=2`
- **Resposta 200:** `{ "books": [{ "id": "OL1003040W", "title": "Dom Casmurro" }], "total": 85, "page": 1, "limit": 2, "hasMore": true }`, com cada livro completo no formato de [Livro](#livro). `hasMore` é `true` enquanto `page` vezes `limit` for menor que `total`.
- **Erros:**
  - 400 `Digite pelo menos dois caracteres para buscar.`
  - 400 `Categoria inválida`
  - 400 `Página e tamanho devem ser números inteiros positivos`
  - 502 `Não foi possível conectar à Open Library.`, `A Open Library não conseguiu responder (HTTP 503).` (com o status que ela devolveu) ou `A Open Library retornou uma resposta inválida.`
  - 504 `A Open Library demorou para responder.`

### GET /api/books/:id

Detalhe de uma obra, com sinopse.

- **Token:** sim.
- **Parâmetros:** `id` da obra na Open Library, como `OL1003040W`.
- **Resposta 200:** `{ "book": { "id": "OL1003040W", "title": "Dom Casmurro", "description": "Romance de Machado de Assis publicado em 1899." } }`, com o livro completo no formato do detalhe em [Livro](#livro).
- **Erros:**
  - 400 `Identificador de livro inválido`
  - 404 `Livro não encontrado na Open Library.`
  - 502 ou 504 da Open Library, com as mensagens da busca.

## Avaliações

Cada pessoa avalia cada livro uma vez. Qualquer pessoa logada lê qualquer avaliação; editar e excluir é só de quem escreveu.

A resenha é gravada já limpa: sem espaços nas pontas nem repetidos, sem caracteres invisíveis e com no máximo uma linha em branco seguida. Os limites de tamanho valem para o texto limpo.

### POST /api/avaliacoes

Avalia um livro.

- **Token:** sim. A avaliação fica no nome de quem está logado.
- **Corpo:** `{ "livroId": "OL1003040W", "nota": 5, "resenha": "Uma leitura muito boa, recomendo." }`
  - `nota`: inteiro de 1 a 5.
  - `resenha`: obrigatória, de 10 a 5.000 caracteres, com pelo menos uma letra ou emoji, e não pode ser um caractere só repetido.
  - Título, autores e capa vêm da Open Library, e não do corpo.
- **Resposta 201:** `{ "avaliacao": { "id": 1, "nota": 5, "resenha": "Uma leitura muito boa, recomendo." } }`, com a avaliação completa no formato de [Avaliação](#avaliação).
- **Erros:**
  - 400 `Identificador de livro inválido`
  - 400 com `errors.nota` e/ou `errors.resenha`: `A nota é obrigatória`, `A nota deve ser um número inteiro de 1 a 5`, `A resenha deve ser um texto`, `A resenha é obrigatória`, `A resenha deve ter pelo menos 10 caracteres`, `A resenha deve ter no máximo 5000 caracteres`, `A resenha precisa ter palavras ou emoji, não só números ou símbolos` ou `A resenha não pode ser só um caractere repetido`.
  - 404 `Livro não encontrado na Open Library.`
  - 409 quando a pessoa já avaliou o livro, mesmo que por outro id que a Open Library depois juntou a este. A resposta traz o id da avaliação existente, para o app abrir a edição: `{ "error": "Você já avaliou este livro. Edite a avaliação existente.", "avaliacaoId": 1 }`. Esse 409 é conferido antes da nota e da resenha.
  - 502 ou 504 da Open Library.

### GET /api/avaliacoes/livro/:livroId

Avaliações de um livro, com a média, em páginas.

- **Token:** sim.
- **Parâmetros:** `livroId`, o id da obra. Na query, `page` (padrão 1) e `limit` (padrão 10, máximo 20; acima disso vira 20).
- **Resposta 200:** `{ "avaliacoes": [{ "id": 1, "nota": 5, "usuarioNome": "Ana Exemplo", "minha": false }], "total": 1, "media": 5, "page": 1, "limit": 10, "hasMore": false }`, com cada avaliação completa.
  - A avaliação de quem está logado vem primeiro, depois as mais novas.
  - `media` tem uma casa decimal e é `null` quando o livro não tem avaliações.
- **Erros:**
  - 400 `Identificador de livro inválido`
  - 400 `Página e tamanho devem ser números inteiros positivos`

### GET /api/avaliacoes/minhas

Avaliações de quem está logado, das mais novas para as mais antigas, sem paginação.

- **Token:** sim. Só as próprias avaliações.
- **Parâmetros e corpo:** nenhum.
- **Resposta 200:** `{ "avaliacoes": [{ "id": 1, "nota": 5, "usuarioNome": "Ana Exemplo", "minha": true }] }`, com cada avaliação completa.
- **Erros:** nenhum próprio.

### GET /api/avaliacoes/:id

Uma avaliação.

- **Token:** sim. Qualquer pessoa logada lê qualquer avaliação.
- **Parâmetros:** `id` da avaliação.
- **Resposta 200:** `{ "avaliacao": { "id": 1, "nota": 5, "usuarioNome": "Ana Exemplo", "minha": false } }`, com a avaliação completa.
- **Erros:**
  - 400 `Identificador de avaliação inválido`
  - 404 `Avaliação não encontrada`

### PUT /api/avaliacoes/:id

Edita a nota e a resenha. O livro não muda.

- **Token:** sim. Só quem escreveu a avaliação.
- **Parâmetros:** `id` da avaliação.
- **Corpo:** `{ "nota": 4, "resenha": "Uma leitura boa, recomendo." }`, com as regras da criação.
- **Resposta 200:** `{ "avaliacao": { "id": 1, "nota": 4, "resenha": "Uma leitura boa, recomendo." } }`, com a avaliação completa e `atualizadoEm` novo.
- **Erros:**
  - 400 `Identificador de avaliação inválido`, ou validação com `errors.nota` e/ou `errors.resenha`.
  - 403 `Você só pode alterar a sua própria avaliação`
  - 404 `Avaliação não encontrada`

### DELETE /api/avaliacoes/:id

Exclui a avaliação. Os comentários dela são apagados junto; as notificações sobre eles ficam, com `alvoDisponivel: false`.

- **Token:** sim. Só quem escreveu a avaliação.
- **Parâmetros:** `id` da avaliação.
- **Resposta 200:** `{ "message": "Avaliação excluída!" }`
- **Erros:**
  - 400 `Identificador de avaliação inválido`
  - 403 `Você só pode alterar a sua própria avaliação`
  - 404 `Avaliação não encontrada`, inclusive ao excluir de novo.

## Comentários

Comentários e respostas de uma avaliação. Qualquer pessoa logada lê e comenta qualquer avaliação; editar e remover é só do autor. O autor vem sempre do token: o corpo não escolhe autor nem avaliação, e um campo fora do contrato dá 400. Os erros de comentário vão para o log do backend só com o contexto e a mensagem do erro, nunca com o texto, o token ou a senha.

O texto passa pela mesma limpeza da resenha e precisa ter de 1 a 2.000 caracteres depois dela.

### GET /api/avaliacoes/:id/comentarios

Lista os comentários de uma avaliação, de dois jeitos.

- **Token:** sim.
- **Parâmetros:** `id` da avaliação.
- **Lista completa**, sem query: `{ "comentarios": [{ "id": 1, "paiId": null, "texto": "Concordo com a resenha!" }, { "id": 2, "paiId": 1, "texto": "Obrigada!" }] }`, com todos os comentários e respostas, removidos incluídos, por id crescente (ordem de criação).
- **Página**, com pelo menos um destes na query:
  - `limite`: comentários por página, de 1 a 50 (padrão 20).
  - `cursor`: o `proximoCursor` da página anterior. A página traz os comentários de id maior que ele.
  - `paiId`: sem ele, vêm só os comentários diretos na avaliação; com ele, as respostas diretas daquele comentário.

  A resposta é `{ "comentarios": [{ "id": 1, "paiId": null, "texto": "Concordo com a resenha!", "respostas": 1 }], "pai": null, "proximoCursor": 1, "temMais": false }`. Cada comentário traz `respostas`, o total de respostas diretas. `pai` é o comentário de `paiId` (ou `null`), `proximoCursor` é o id do último da página (numa página vazia, volta o `cursor` enviado, ou `null`) e `temMais` diz se há outra página.
- Os comentários de todos os exemplos vêm completos, no formato de [Comentário](#comentário).
- **Erros:**
  - 400 `Identificador de avaliação inválido`
  - 400 `Paginação inválida`, para `limite`, `cursor` ou `paiId` que não sejam inteiros positivos, ou `limite` acima de 50.
  - 404 `Avaliação não encontrada`
  - 404 `Comentário não encontrado`, quando o `paiId` não é um comentário desta avaliação.

### POST /api/avaliacoes/:id/comentarios

Comenta numa avaliação ou responde a um comentário dela.

- **Token:** sim. O autor é quem está logado.
- **Parâmetros:** `id` da avaliação. Header opcional `Idempotency-Key` (abaixo).
- **Corpo:** `{ "texto": "Concordo com a resenha!" }` para comentar, ou `{ "texto": "Obrigada!", "paiId": 1 }` para responder. O `paiId` precisa ser de um comentário desta avaliação que não foi removido.
- **Resposta 201:** `{ "comentario": { "id": 2, "paiId": 1, "texto": "Obrigada!", "versao": 1 } }`, com o comentário completo.
- Gera notificação para o autor da avaliação e, na resposta, para o autor do comentário respondido (ver [Notificações](#notificações)).
- **Erros:**
  - 400 `Identificador de avaliação inválido`, `Identificador de comentário inválido` (no `paiId`), `Idempotency-Key inválida` ou `Campo fora do contrato: autor` (com o nome do campo).
  - 400 com `errors.texto`: `O comentário é obrigatório`, `O comentário deve ser um texto` ou `O comentário deve ter no máximo 2000 caracteres`.
  - 404 `Avaliação não encontrada`
  - 404 `Comentário não encontrado`, quando o `paiId` não é um comentário desta avaliação.
  - 409 `Este comentário foi removido`, ao responder a um comentário removido.
  - 409 `Idempotency-Key já usada em outra mensagem`
  - 413 `O corpo da requisição passou de 32 KB`
  - 429 limite de comentários (ver [429 com Retry-After](#429-com-retry-after)).

**Idempotency-Key.** Para um reenvio não duplicar a mensagem, o cliente pode mandar o header `Idempotency-Key`: uma chave nova para cada mensagem, de 16 a 100 caracteres entre letras sem acento, números, `-` e `_` (um UUID serve), repetida a cada nova tentativa da mesma mensagem.

- Mesma chave e mesma mensagem (mesma avaliação, mesmo `paiId` e mesmo texto já limpo) devolvem 201 com o comentário já gravado, como ele está agora, mesmo que o pai tenha sido removido depois.
- Mesma chave com outra mensagem dá 409. Se a avaliação, o `paiId` ou o texto mudar antes de tentar de novo, é outra mensagem e precisa de outra chave.
- A chave vale só para quem enviou e é esquecida depois de 24 horas.
- Sem o header, cada envio grava um comentário novo.

### PUT /api/comentarios/:id

Edita o texto do próprio comentário. O pai e a avaliação não mudam.

- **Token:** sim. Só o autor do comentário.
- **Parâmetros:** `id` do comentário.
- **Corpo:** `{ "texto": "Concordo muito com a resenha!", "versao": 1 }`, com a `versao` que a pessoa estava vendo.
- **Resposta 200:** `{ "comentario": { "id": 1, "texto": "Concordo muito com a resenha!", "versao": 2 } }`, com o comentário completo, a `versao` somada de 1 e `atualizadoEm` novo.
- **Erros:**
  - 400 `Identificador de comentário inválido` ou `Campo fora do contrato: paiId` (com o nome do campo).
  - 400 com `errors.texto`, com as mensagens da criação, ou com `errors.versao`: `Versão do comentário inválida`.
  - 403 `Você só pode alterar o seu próprio comentário`
  - 404 `Comentário não encontrado`
  - 409 de versão, com o comentário atual (ver [409 de versão do comentário](#409-de-versão-do-comentário)).
  - 409 `Este comentário foi removido`
  - 413 `O corpo da requisição passou de 32 KB`

### DELETE /api/comentarios/:id

Remove o próprio comentário sem apagar o lugar dele na conversa: o texto some e as respostas continuam.

- **Token:** sim. Só o autor do comentário.
- **Parâmetros:** `id` do comentário.
- **Resposta 200:** `{ "comentario": { "id": 1, "texto": null, "removido": true, "podeEditar": false, "podeExcluir": false } }`, com o comentário completo.
- **Erros:**
  - 400 `Identificador de comentário inválido`
  - 403 `Você só pode alterar o seu próprio comentário`
  - 404 `Comentário não encontrado`
  - 409 `Este comentário foi removido`, ao remover de novo.

### GET /api/avaliacoes/:id/comentarios/:comentarioId/contexto

Abre a conversa em volta de um comentário, para quem chega por uma notificação.

- **Token:** sim.
- **Parâmetros:** `id` da avaliação e `comentarioId`. Na query, opcionais: `eventoId`, o da notificação, que precisa bater com o do comentário; e `apos`, o `proximoCursor` da página anterior.
- **Resposta 200:**

```json
{
  "avaliacaoId": 1,
  "livroId": "OL1003040W",
  "comentarioId": 2,
  "alvo": { "id": 2, "paiId": 1, "texto": "Obrigada!" },
  "ancestrais": [{ "id": 1, "paiId": null, "texto": "Concordo com a resenha!" }],
  "comentarios": [{ "id": 2, "paiId": 1, "texto": "Obrigada!" }],
  "proximoCursor": null,
  "ancestralAnteriorId": null
}
```

  Os comentários vêm completos, no formato de [Comentário](#comentário).
  - `alvo` é o comentário pedido, e `ancestrais` é a cadeia acima dele, do mais alto ao mais próximo, com até 50 comentários.
  - `comentarios` traz até 20 comentários da avaliação por id crescente, a partir do alvo. Para a próxima página, mande o `proximoCursor` em `apos`; ele é `null` na última.
  - `ancestralAnteriorId` é o id do próximo ancestral quando a cadeia passa de 50, e `null` quando ela coube inteira.
- **Erros:**
  - 400 `Contexto de comentário inválido`, para ids, `apos` ou `eventoId` fora do formato.
  - 400 `Página inválida`, quando `apos` é menor que o id do alvo.
  - 404 `Comentário não encontrado nesta avaliação`, inclusive quando o `eventoId` não bate.
  - 404 `Contexto da conversa indisponível`, quando falta um ancestral.
  - 409 `Conversa com referência circular`
  - 410 `Este comentário foi removido`
  - 500 `Não foi possível abrir a conversa`

## Notificações

Avisos de comentários e respostas. Não há push, e-mail nem WebSocket: o app consulta estas rotas.

- Comentário numa avaliação avisa o autor da avaliação (`comentario`).
- Resposta avisa o autor do comentário respondido (`resposta`) e o autor da avaliação (`comentario`). Se for a mesma pessoa, ela recebe só a de `resposta`.
- Ninguém é avisado do que ele mesmo escreveu, e o reenvio com a mesma `Idempotency-Key` não gera aviso novo.

Todas as rotas são do usuário do token: ninguém vê nem marca a notificação de outra pessoa. Falha interna nestas rotas dá 500 `Não foi possível acessar as notificações`.

### GET /api/notificacoes

Lista as notificações, das mais novas para as mais antigas.

- **Token:** sim.
- **Parâmetros (query):** `limit`, de 1 a 50 (padrão 20); `cursor`, o `proximoCursor` da página anterior, mandado como veio.
- **Resposta 200:** `{ "notificacoes": [{ "id": "6f1c2b9e-3d4a-4e8b-9c1d-2a3b4c5d6e7f", "tipo": "resposta", "lidaEm": null }], "proximoCursor": null }`, com cada notificação completa no formato de [Notificação](#notificação). `proximoCursor` é `null` na última página.
- **Erros:** 400 `Paginação inválida`.

### GET /api/notificacoes/nao-lidas

Conta as notificações não lidas.

- **Token:** sim.
- **Parâmetros e corpo:** nenhum.
- **Resposta 200:** `{ "total": 1 }`
- **Erros:** nenhum próprio.

### PATCH /api/notificacoes/:id/lida

Marca uma notificação como lida.

- **Token:** sim.
- **Parâmetros:** `id` (UUID) da notificação. Sem corpo.
- **Resposta 200:** `{ "atualizadas": 1 }`. Marcar de novo uma já lida também dá 200 e mantém a data da primeira leitura.
- **Erros:**
  - 400 `Identificador inválido`
  - 404 `Notificação não encontrada`, inclusive para a de outra pessoa.

### PATCH /api/notificacoes/lidas

Marca todas as notificações como lidas.

- **Token:** sim.
- **Parâmetros e corpo:** nenhum.
- **Resposta 200:** `{ "atualizadas": 3 }`, o número das que ainda não estavam lidas.
- **Erros:** nenhum próprio.

## Biblioteca

Os livros de cada pessoa, com status de leitura, favorito e progresso. Todas as rotas são do usuário do token: o item de outra pessoa responde como se não existisse (404). O "dia" de leitura segue o fuso de São Paulo (`America/Sao_Paulo`).

### GET /api/biblioteca

Lista os livros da biblioteca, dos adicionados por último para os mais antigos.

- **Token:** sim.
- **Parâmetros (query):** `status`, opcional: `QUERO_LER`, `LENDO`, `LIDO` ou `ABANDONADO`.
- **Resposta 200:** `{ "itens": [{ "id": 1, "statusLeitura": "LENDO", "favorito": true }] }`, com cada item completo no formato de [Item da biblioteca](#item-da-biblioteca).
- Depois de responder, o backend busca na Open Library o número de páginas que falta em até 10 livros em `LENDO` ou `LIDO`. O resultado aparece na próxima consulta.
- **Erros:** 400 `Status de leitura inválido`.

### POST /api/biblioteca

Adiciona um livro.

- **Token:** sim.
- **Corpo:** `{ "livroId": "OL1003040W", "status": "QUERO_LER" }`. `status` é opcional, e o padrão é `QUERO_LER`.
- Título, autores, capa e número de páginas vêm da Open Library. Em `LENDO`, o livro já começa com hoje como dia de leitura; em `LIDO`, começa concluído, com a página atual igual ao total.
- **Resposta 201:** `{ "item": { "id": 1, "statusLeitura": "QUERO_LER", "favorito": false } }`, com o item completo.
- **Erros:**
  - 400 `Identificador de livro inválido`
  - 400 `Status de leitura inválido`
  - 404 `Livro não encontrado na Open Library.`
  - 409 `Este livro já está na sua biblioteca.`
  - 502 ou 504 da Open Library.

### PATCH /api/biblioteca/:id

Muda o status, o favorito ou o progresso de um item.

- **Token:** sim.
- **Parâmetros:** `id` do item.
- **Corpo:** pelo menos um destes campos: `status`; `favorito` (`true` ou `false`); `paginaAtual` (inteiro de 0 a 100.000); `paginasTotal` (inteiro de 1 a 100.000). Exemplo: `{ "status": "LENDO", "paginaAtual": 120 }`.
  - `paginaAtual` não pode passar do total de páginas conhecido.
  - Passar para `LENDO` conta hoje como dia de leitura. Passar para `LENDO` ou `LIDO` sem total conhecido busca o número de páginas na Open Library.
  - Passar para `LIDO` grava `concluidoEm` e leva a página atual ao total; sair de `LIDO` limpa `concluidoEm`.
  - Um `paginasTotal` menor que a página atual, ou num livro lido, leva a página atual junto.
- **Resposta 200:** `{ "item": { "id": 1, "statusLeitura": "LENDO", "favorito": true } }`, com o item completo.
- **Erros:**
  - 400 `Identificador inválido`, `Informe status, favorito ou progresso`, `Status de leitura inválido`, `Favorito deve ser verdadeiro ou falso`, `Página atual inválida` ou `Número de páginas inválido`.
  - 400 `O livro tem 269 páginas.`, quando a página atual passa do total.
  - 404 `Livro não encontrado na sua biblioteca.`

### DELETE /api/biblioteca/:id

Tira um livro da biblioteca.

- **Token:** sim.
- **Parâmetros:** `id` do item.
- **Resposta 200:** `{ "message": "Livro removido da biblioteca!" }`
- **Erros:**
  - 400 `Identificador inválido`
  - 404 `Livro não encontrado na sua biblioteca.`, inclusive ao remover de novo.

### POST /api/biblioteca/dia-de-leitura

O app chama ao abrir. Soma 1 dia de leitura, no máximo uma vez por dia, a cada livro em `LENDO`, e 1 dia ao perfil se houver algum livro em `LENDO`. Dois livros no mesmo dia contam como um dia só no perfil.

- **Token:** sim.
- **Parâmetros e corpo:** nenhum.
- **Resposta 200:** `{ "livrosAtualizados": 1, "diasLeitura": 5 }`. `livrosAtualizados` conta os livros que ganharam o dia nesta chamada (0 se o dia já tinha sido contado), e `diasLeitura` é o total do perfil.
- **Erros:** nenhum próprio.

### GET /api/biblioteca/dias-de-leitura

Total de dias de leitura do perfil.

- **Token:** sim.
- **Parâmetros e corpo:** nenhum.
- **Resposta 200:** `{ "diasLeitura": 5 }`
- **Erros:** nenhum próprio.
