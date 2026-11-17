# Build e publicação

Como gerar uma versão do app que fala com o backend publicado e como saber qual versão é cada build. Os comandos rodam dentro de `mobile/`, a não ser quando o texto indica outra pasta.

O destino da versão (APK, web ou os dois) ainda está sendo definido no #210. Ver [O que ainda falta definir](#o-que-ainda-falta-definir).

## Ambiente de produção

| Peça                                 | Onde está                                                            |
| ------------------------------------ | -------------------------------------------------------------------- |
| Backend                              | Render, em `https://alexandria-api-ybps.onrender.com`                |
| Banco                                | PostgreSQL no Supabase, acessado pelo backend                        |
| URL da API para `npm run start:prod` | [`.env.production`](../.env.production)                              |
| URL da API nos builds do EAS         | [`eas.json`](../eas.json), em cada perfil (`preview` e `production`) |

O app recebe a URL da API na hora do build: tudo que começa com `EXPO_PUBLIC_` vai para dentro do app. Por isso:

- nunca coloque um segredo numa variável `EXPO_PUBLIC_`;
- um APK já instalado continua com a URL antiga. Mudou a URL, só um build novo leva a mudança.

Para trocar o backend publicado, mude a URL, sem `/api` no final, em quatro lugares:

- no `.env.production`;
- nos dois perfis do `eas.json`;
- no keep-alive, em `.github/workflows/keep-alive.yml`.

O timeout de 60 s (`EXPO_PUBLIC_API_TIMEOUT`) também está repetido no `.env.production` e no `eas.json`. Ele existe porque o Render grátis dorme depois de 15 minutos parado e leva cerca de 1 minuto para acordar.

As variáveis do backend publicado ficam no painel do Render, nunca no repositório. O modelo, com a explicação de cada uma, está em [`backend/.env.example`](../../backend/.env.example).

| Variável                      | Para quê                                                                                                                                     |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                | Banco do Supabase. Com ela, o backend usa PostgreSQL, com SSL ligado.                                                                        |
| `JWT_SECRET`                  | Assina as sessões. Sem ela, o backend não sobe.                                                                                              |
| `NODE_ENV=production`         | Com ela, o backend se recusa a subir se `RESET_CODE_DEBUG=true`, que mostraria o código de redefinição de senha no log e na resposta da API. |
| `BREVO_API_KEY` e `MAIL_FROM` | Enviam o e-mail com o código de redefinição de senha. O Render grátis bloqueia SMTP, então o Gmail não funciona lá.                          |
| `DEEPL_AUTH_KEY`              | Opcional. Traduz títulos e sinopses.                                                                                                         |
| `CORS_ORIGINS`                | Opcional. Origens web permitidas; vazio libera todas.                                                                                        |

## Versão de cada build

Dois campos do [`app.json`](../app.json) definem a versão:

- **`expo.version`** (hoje `1.0.0`): a versão que a pessoa vê, na tela Sobre do app e nas configurações do Android.
- **`android.versionCode`** (hoje `1`): o número que o Android usa para saber qual APK é mais novo. Um APK só instala por cima de outro se o `versionCode` dele for maior.

O `eas.json` usa `"appVersionSource": "local"`. Com isso, o EAS lê esses dois campos do `app.json` e não aumenta nenhum deles sozinho.

Para uma versão nova:

1. No `app.json`, suba o `expo.version` (por exemplo, de `1.0.0` para `1.1.0`) e some 1 ao `android.versionCode`.
2. Use o mesmo número na branch `release/X.Y.Z`. Quando ela entra na main, o CI cria a tag `vX.Y.Z` e a release no GitHub (ver `.github/workflows/ci_v2.yml`). Assim, a versão do app e a tag contam a mesma história.
3. Gere o build a partir desse commit.

Para saber a versão e a data de um build:

- **No expo.dev:** a aba Builds do projeto mostra, em cada build, a data, a versão, o `versionCode`, o perfil e o commit de onde ele saiu.
- **No aparelho:** a tela Sobre mostra a versão instalada.

## Passo a passo de uma versão

1. **Publique o backend antes do app.** O backend cria as tabelas e colunas novas quando sobe. Um app novo falando com um backend velho pode falhar: a busca só por categoria, por exemplo, dá 400.
2. **Confira a dev.** O CI precisa estar verde, e o roteiro manual em [`.github/workflows/README.md`](../../.github/workflows/README.md) precisa ter sido feito.
3. **Confira a URL** nos lugares da seção [Ambiente de produção](#ambiente-de-produção).
4. **Ajuste a versão** como em [Versão de cada build](#versão-de-cada-build).
5. **Gere o build** seguindo a seção "Gerar o APK" do [README](../README.md#gerar-o-apk):

   ```sh
   npx eas-cli@latest build -p android --profile preview
   ```

   - O projeto já está vinculado ao EAS: o `projectId` está no `app.json`, na conta `davi_almeida99`. Não rode `eas init` de novo.
   - Só quem é membro desse projeto no expo.dev consegue gerar o build e ver a aba Builds. Peça acesso ao dono da conta.

## O que ainda falta definir

- **Destino e instalação (#210):** onde a equipe disponibiliza a versão aprovada (APK, web ou os dois) e como instalar.
- **Conferência deste guia (#215):** seguir o guia até um build que fale com a API publicada. Para isso, alguém com acesso ao projeto no expo.dev precisa gerar o build.
