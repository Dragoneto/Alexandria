# Testes de persistência das conversas

Esta suíte verifica se o JSON local e o PostgreSQL se comportam igual nas conversas: comentários, respostas, edição e exclusão. Os mesmos cenários e as mesmas asserções rodam nos dois modos, então uma diferença entre eles aparece como um teste que falha só em um dos modos.

Complementa o roteiro de ponta a ponta do #169, que valida o fluxo pelo app. Aqui a verificação vai até o armazenamento: depois de cada cenário, a suíte lê direto o arquivo ou a tabela e confere se não sobrou órfão.

## Como rodar

Em `backend/`:

| Comando | O que roda | Do que precisa |
| --- | --- | --- |
| `npm test` | Todo o backend. Os cenários de PostgreSQL aparecem como `skipped` sem `TEST_DATABASE_URL` | Nada |
| `npm run test:persistencia` | Só esta suíte, com o mesmo `skipped` | Nada |
| `npm run test:persistencia:pg` | Só esta suíte, nos dois modos, em um PostgreSQL descartável | Os executáveis do PostgreSQL instalados |

**Sempre confira o resumo.** `skipped` significa que o PostgreSQL não foi testado, e o verde desse caso só vale para o JSON local.

### PostgreSQL descartável (recomendado)

`npm run test:persistencia:pg` cria um cluster novo em uma pasta temporária, em porta livre e só em `127.0.0.1`. Roda a suíte e apaga tudo no fim. Não usa o serviço do PostgreSQL da sua máquina, nem senha, nem o `.env`.

Se o comando não achar `initdb`, `pg_ctl` e `createdb`, indique a pasta deles em `PG_BIN`. Para rodar outro arquivo de teste no mesmo tipo de banco:

```sh
node scripts/postgres-de-teste.js tests/change-password.test.js
```

### Um banco de teste seu

`TEST_DATABASE_URL` aponta a suíte para um banco que já existe. A variável precisa estar no ambiente do comando, porque **os testes não leem o `.env`, de propósito**. O SSL fica desligado, a menos que `DB_SSL=true`.

```powershell
# Uma vez, no PostgreSQL da sua máquina
psql -U postgres -c "CREATE DATABASE alexandria_test"

# PowerShell
$env:TEST_DATABASE_URL = "postgresql://postgres:SUA_SENHA@localhost:5432/alexandria_test"
npm run test:persistencia
Remove-Item Env:TEST_DATABASE_URL
```

```sh
# Docker (este comando não foi executado na validação registrada abaixo)
docker run --rm -d --name alexandria-test -e POSTGRES_PASSWORD=teste -e POSTGRES_DB=alexandria_test -p 55432:5432 postgres:18
TEST_DATABASE_URL=postgresql://postgres:teste@localhost:55432/alexandria_test npm run test:persistencia
docker stop alexandria-test
```

### No CI

Defina `EXIGIR_POSTGRES_DE_TESTE=true` junto com `TEST_DATABASE_URL`. Assim, um segredo faltando vira falha, e não um `skipped` silencioso. A automação nos PRs é o #179; este card não altera nenhum workflow.

## Proteção do banco

A suíte apaga dados, então `tests/persistencia/banco-de-teste.js` recusa a execução, antes de conectar, se:

- `NODE_ENV` for `production`;
- o nome do banco não contiver `test`;
- o host não for local, a menos que `TEST_DATABASE_PERMITIR_REMOTO=true`;
- o destino for o mesmo banco de `DATABASE_URL` ou `DB_*`, do ambiente ou do `backend/.env`.

`DATABASE_URL` nunca é usada como destino: só `TEST_DATABASE_URL`. As variáveis de banco do processo de teste são apagadas antes de carregar `src/`, e `server.js`, que carrega o `.env`, nunca é carregado. As mensagens de erro não citam a senha.

## O que fica isolado

| | JSON local | PostgreSQL |
| --- | --- | --- |
| **Inicialização** | Pasta temporária própria (`LOCAL_*_FILE`). `backend/.data` não é tocada | Um schema `conversas_teste_<pid>_<aleatório>` por execução. A suíte confere `current_schema()` antes de criar qualquer tabela |
| **Entre cenários** | Apaga só os três arquivos dessa pasta | `TRUNCATE` com nome qualificado e sem `CASCADE`, só no schema da execução |
| **No fim** | Apaga a pasta | `DROP SCHEMA` só desse schema, conferindo que ele sumiu |

Se a execução for interrompida à força, um schema `conversas_teste_*` pode ficar no banco de teste. Ele não atrapalha as próximas execuções.

## O que é coberto

| Critério do #178 | Situação | Cenários |
| --- | --- | --- |
| Criar, responder, editar e excluir preservando filhos | Coberto nos dois modos | Três níveis de resposta, exclusão do pai e do comentário do meio, texto apagado de verdade, permissão, validação, Unicode |
| Pai de outra avaliação | Coberto nos dois modos | Pai de outra avaliação, inexistente ou removido, sem gravar nada |
| Exclusão concorrente da avaliação | Coberto nos dois modos | Corridas forçadas em comentar, responder, editar e excluir, e requisições HTTP realmente paralelas |
| Integridade referencial e ausência de órfãos | Coberto nos dois modos | Invariantes conferidas depois de **todo** cenário. No PostgreSQL, também as restrições do próprio banco e a igualdade entre `init.sql` e `initialize()` |
| Paginação determinística | Coberto nos dois modos | Ordem dos comentários, páginas de avaliações do livro com empate de data e cursor de comentários e respostas (#168) |
| Chave de idempotência | **Pendente** | Depende do #171, que ainda não existe na API |
| Conflito de versão | **Pendente** | Depende do #172, que ainda não existe na API |

Os itens pendentes aparecem como `# TODO` na saída dos testes. Sem contrato definido, um teste inventaria a API e daria uma falsa impressão de cobertura. Quem entregar cada card troca o `test.todo` de `tests/persistencia/cenarios.js` por um cenário real.

## Como adicionar um cenário

- `tests/persistencia/cenarios.js`: os cenários. Um teste aqui roda nos dois modos.
- `tests/persistencia/fixtures.js`: `novaConversa()` (Ana, Bia e uma conversa de três níveis), `novoLeitor()`, `novaAvaliacao()` e as chamadas à API.
- `tests/persistencia/ambiente.js`: o que difere entre os modos, como `lerArmazenamento()`.
- `tests/conversas-local.test.js` e `tests/conversas-postgres.test.js`: testes que só fazem sentido em um modo.

Não fixe ids nas asserções, porque eles não são iguais entre os modos: use os devolvidos pelas fixtures. Cada cenário começa com o armazenamento vazio.

## Divergências que a suíte encontrou

As duas foram corrigidas, e o comportamento do PostgreSQL foi mantido como referência:

1. **Erro 500 em gravações simultâneas no JSON local (Windows).** O `rename` falhava com `EPERM` enquanto outra requisição lia o arquivo. Comentários, avaliações e usuários agora tentam de novo (`src/repositories/arquivoLocal.js`).
2. **Surrogate solto no texto.** O PostgreSQL gravava `U+FFFD`, e o JSON local guardava o caractere inválido. `limparResenha` agora normaliza nos dois modos.

## Limitações conhecidas

**Diferenças que continuam entre os modos:**

- **O JSON local reaproveita ids.** O próximo id é o maior + 1, então a avaliação criada depois de apagar a de maior id herda o número. Se isso acontecer entre a checagem e a gravação de um comentário, ele cai na avaliação nova, enquanto o PostgreSQL responde 404. O cenário está marcado como `todo` só no JSON local, e essa falha aparece na saída de propósito.
- **O JSON local não tem chave estrangeira.** Quem protege é o controlador, então gravar direto pelo repositório pode criar um órfão no arquivo, o que o PostgreSQL recusa.
- **O JSON local não é atômico entre arquivos.** Se o processo morrer entre gravar a avaliação e levar os comentários dela, ficam órfãos. O modo também só é seguro com um único processo da API.

**Valem para os dois modos:**

- **Resposta a um pai recém-removido.** Se o pai for removido entre a checagem e a gravação, a resposta é aceita. O cenário só garante que o armazenamento continua consistente; o #129 pede que essa resposta seja recusada.
- **Pai de outra avaliação.** Só a API recusa. Nada no banco impede, porque a chave estrangeira não inclui a avaliação.
- **Exclusão de conta.** A API ainda não exclui contas. Se isso for criado, o `ON DELETE CASCADE` do `pai_id` apaga também as respostas de outras pessoas, o que contraria a regra de preservar os filhos.
- **Paginação de avaliações.** Ela usa `OFFSET`, então incluir ou excluir entre duas páginas desloca os itens.

**Limites da própria verificação:**

- A suíte sobe as rotas reais de avaliações e comentários, com autenticação e validação, nos mesmos caminhos, mas não o `server.js`. Isso evita carregar o `.env`.
- A concorrência é testada contra um único processo da API. Várias instâncias sobre o mesmo PostgreSQL não foram testadas.
- `bibliotecaRepository` e `passwordResetRepository` têm o mesmo `rename` sem nova tentativa. Ficaram fora deste card, que trata das conversas.

## Execução registrada

Em 05/11/2026, no Windows 11, com Node 24.13.0 e PostgreSQL 18.3 (cluster descartável, UTF8), a partir do commit `06e90f9` da `dev`:

| Comando | Testes | Aprovados | Falhas | `todo` | `skipped` |
| --- | --- | --- | --- | --- | --- |
| `npm test` | 144 | 138 | 0 | 5 | 1 (PostgreSQL não executado) |
| `npm run test:persistencia:pg` | 75 | 66 | 0 | 9 | 0 |
| `node scripts/postgres-de-teste.js tests/*.test.js` (backend inteiro) | 178 | 169 | 0 | 9 | 0 |

Só os cenários de conversa, por modo:

| Modo | Testes | Aprovados | `todo` |
| --- | --- | --- | --- |
| JSON local | 31 | 26 | 5 (os 4 pendentes e o id reaproveitado) |
| PostgreSQL | 35 | 31 | 4 (os pendentes) |

O cenário do id reaproveitado aparece com `✖` na saída do JSON local, mas não reprova a execução: é a limitação descrita acima.

Também foi verificado:

- **Estabilidade:** 15 de 15 execuções seguidas no JSON local e 5 de 5 no PostgreSQL.
- **Detecção de regressões:** 18 de 18 bugs injetados de propósito, um por vez, fizeram a suíte falhar no modo esperado. Entre eles: editar comentário removido, aceitar pai de outra avaliação, deixar órfãos, retirar uma chave estrangeira ou um cascade, inverter a ordem e `init.sql` diferente dos repositórios. Essa verificação foi manual, e o script dela não está no repositório.
- **Travas:** recusa real, antes de conectar, de banco sem `test` no nome, host remoto, banco igual a `DATABASE_URL` e `NODE_ENV=production`, sem a senha aparecer na saída.
- **Limpeza:** nenhum processo `postgres` do cluster descartável nem pasta temporária sobrou depois das execuções.

**Não foi executado:**

- o comando Docker acima;
- `TEST_DATABASE_URL` apontando para um PostgreSQL instalado como serviço (a mesma variável foi exercitada pelo cluster descartável);
- Linux e macOS: o script tem caminhos e opções para eles, mas só rodou no Windows;
- o CI, que é o #179;
- o fluxo pelo app, web ou aparelho, que é o #169;
- idempotência, conflito de versão e cursor de comentários, porque ainda não existem na API.
