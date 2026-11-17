# CI do Alexandria

Os workflows desta pasta são:

- `ci_v2.yml`: as checagens de regressão (#179) e o merge automático das PRs aprovadas (#61).
- `keep-alive.yml`: chama a API publicada a cada 3 dias para o Supabase não pausar. Ele não checa código.

## Quando as checagens rodam

| Evento | O que acontece |
| --- | --- |
| PR aberta, reaberta ou com commit novo | Os jobs **Backend** e **App** rodam. O resultado aparece na PR. |
| Aprovação de alguém do time | Backend e App rodam de novo sobre o código que vai entrar, com os nomes "Backend (aprovação)" e "App (aprovação)". O merge automático só acontece se os dois passarem. |
| Outra revisão (comentário, pedido de mudança, aprovação de fora do time) | Cria uma rodada "(aprovação)" com os jobs pulados. Ela não testa nada nem faz merge. |
| Push na dev (merge feito à mão ou push direto) | Backend e App rodam depois que o código já entrou. Isso só avisa, não desfaz nada. |

As regras do merge automático por nome de branch (`feature/`, `bugfix/`, `release/`, `hotfix/`) estão no começo do `ci_v2.yml`.

## O que cada job confere

**Backend** (menos de 1 minuto):

- `npm ci`, que instala exatamente o que está no `package-lock.json`;
- `npm test` com um PostgreSQL 18 descartável, que só existe durante o job, no banco `alexandria_test`. Os testes rodam no JSON local e no PostgreSQL.
- `EXIGIR_POSTGRES_DE_TESTE=true`: se alguém apagar ou renomear o `TEST_DATABASE_URL`, a suíte reprova (o `conversas-postgres` falha), em vez de ficar verde com o PostgreSQL pulado. Se o banco não subir, o job já falha antes dos testes.

**App** (cerca de 2 minutos):

1. `npm ci`;
2. testes (`npm test`);
3. TypeScript: primeiro gera os tipos das rotas, depois roda o `tsc`;
4. lint (`npm run lint`);
5. bundle Android e bundle web (`expo export`).

Do passo 2 em diante, cada passo roda mesmo se o anterior falhar, para a PR mostrar todos os problemas de uma vez.

## Como reproduzir na sua máquina

Backend:

```sh
cd backend
npm ci
npm test
# Com PostgreSQL, como no CI (precisa do PostgreSQL instalado; se os executáveis não estiverem no PATH, use PG_BIN):
node scripts/postgres-de-teste.js tests/*.test.js
```

App:

```sh
cd mobile
npm ci
npm test
npx expo customize tsconfig.json   # gera os tipos das rotas; o npx expo start também gera
npm run typecheck
npm run lint
npx expo export --platform android
npx expo export --platform web
```

Os tipos das rotas ficam em `mobile/.expo/types` e não vão para o git. Se você criou ou renomeou uma tela e não rodou o app desde então, o `tsc` local vai usar tipos velhos.

## Escopo do lint e problemas que já existiam

- **Escopo:** o padrão do `expo lint`, que olha as pastas `src`, `app` e `components` do app. Só `mobile/src` existe.
- **Erros e avisos:** erro reprova a PR. Aviso aparece, mas não reprova, porque a equipe deixou regras como `react-hooks/set-state-in-effect` como aviso.
- **Fora do escopo (nenhuma regra foi desligada para o lint passar):**
  - `mobile/tests`, `mobile/scripts` e `mobile/mock-api`: o `npx eslint .` quebra com `could not find plugin "@typescript-eslint"`. A regra `@typescript-eslint/no-unused-vars` do `mobile/eslint.config.js` vale também para arquivos `.js` e `.cjs`, onde esse plugin não está registrado. A correção é no `eslint.config.js`.
  - O backend não tem lint configurado.

Situação registrada em 15/11/2026, na dev `a7efb06`:

| Checagem | Resultado |
| --- | --- |
| Lint (`mobile/src`) | 0 erros e 0 avisos |
| TypeScript | 0 erros |
| Testes do backend com PostgreSQL | 259 testes, 0 falhas, 0 `skipped`, 5 `todo` |
| Testes do app | 185 testes, 0 falhas |
| Bundles Android e web | gerados sem erro |

## Quando algo falha

- O passo vermelho do job mostra o que falhou.
- Os erros de TypeScript e de lint aparecem na própria linha do arquivo, na aba "Files changed" da PR. O GitHub mostra no máximo 10 erros e 10 avisos por passo; a lista completa fica no log do passo.
- As falhas de teste ficam no log do passo, com o nome do teste e a asserção. Confira o resumo do final (`ℹ fail`).
- No backend verde, o log mostra um bloco `✖ failing tests` com um teste marcado como `todo`: o id reaproveitado no JSON local, descrito em `backend/docs/testes-persistencia.md`. Esse bloco não reprova.
- Os logs do PostgreSQL aparecem no fim do job Backend, em "Stop containers".

## Segurança

- Os jobs de checagem rodam só com permissão de leitura e não usam nenhum segredo do repositório. Só o job do merge pode escrever.
- A senha do PostgreSQL do CI é de teste e está escrita no `ci_v2.yml`. O banco some no fim do job.
- **Nunca troque o `TEST_DATABASE_URL` do CI por um segredo ou por um banco remoto.** O `backend/tests/change-password.test.js` usa essa variável direto, sem a trava que protege a suíte de persistência, e cria tabelas e contas no banco apontado.

## Limitações: o que um CI verde não garante

- **Merge feito à mão e push direto na dev não esperam as checagens.** O push na dev só avisa depois. Hoje, a única trava é a do merge automático. Para bloquear também o merge feito à mão, o dono do repositório precisa exigir os checks **Backend** e **App** (sem "(aprovação)") na regra (ruleset) da dev. Antes, ele precisa acertar dois detalhes:
  - desmarcar "Require branches to be up to date before merging". Ligado, toda PR atrás da dev fica BEHIND, e o merge automático falha;
  - liberar o GitHub Actions na lista de bypass da regra. Sem isso, o push que sincroniza a dev depois de uma release ou de um hotfix é recusado, porque esse commit não tem checks.
- **PR com conflito não roda checagens:** o GitHub não dispara o workflow nesse caso. Se uma PR ficou sem checks, veja primeiro se há conflito com a base: a dev, ou a main numa PR de release. Numa PR da dev para a main, se aparecer "Approve workflows to run", alguém com permissão de escrita aprova a rodada.
- **A aprovação demora uns 2 minutos para virar merge**, enquanto as checagens rodam de novo.
  - Se elas falharem, não há merge: corrija, dê push e peça uma nova aprovação.
  - Nesse caso, as mensagens de base errada e de conflito do job de merge não aparecem.
- **Push depois da aprovação:** o merge é recusado, porque o commit não é o que foi testado. Peça uma nova aprovação.
- **Duas PRs aprovadas quase juntas** são testadas cada uma contra a dev que viram, não contra a combinação das duas. Merges feitos pelo bot não disparam a rodada da dev. A próxima PR é a primeira a testar o conjunto.
- **Uma PR que muda o `ci_v2.yml` roda a própria versão do arquivo.** Revise com cuidado as mudanças nele.

## Roteiro manual (complementa a #169)

Pipeline verde não é o mesmo que app testado no aparelho. Antes de uma release ou ao fechar uma sprint:

1. Siga o registro da #169 (`mobile/docs/validacao-sprint-5.md`) e a seção Verificação do `mobile/README.md`.
2. Confira também o que o CI não cobre:
   - [ ] **Visual no aparelho:** telas principais num Android físico (Expo Go ou APK), em retrato (o `app.json` trava a orientação); teclado sem cobrir os campos; TalkBack nas telas que mudaram.
   - [ ] **APK de verdade:** o CI só gera o bundle JavaScript. Instale o APK do EAS (perfil preview) e abra login, busca, livro, conversa e biblioteca.
   - [ ] **API publicada:** o app aponta para o backend no Render. A primeira requisição com o servidor dormindo leva até 1 minuto e deve mostrar o aviso de servidor acordando.
   - [ ] **Banco publicado:** o PostgreSQL do CI não usa SSL, e o Supabase usa. Confira se a API publicada responde ao health check e grava uma avaliação e um comentário.
   - [ ] **E-mail real:** o código de redefinição de senha chega na caixa de entrada. O CI não envia e-mail.
   - [ ] **Rede ruim de verdade**, como dados móveis fracos, e não só um atraso simulado no navegador.
   - [ ] **iPhone:** não é testado nem pelo CI nem pelo registro da #169.
3. Registre o que foi testado, com data, aparelho e versão, no mesmo formato do registro da #169.
