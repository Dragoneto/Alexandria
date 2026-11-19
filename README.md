# Alexandria

Biblioteca pessoal para descobrir, organizar e lembrar livros. O repositório tem duas partes: `backend/`, a API em Node.js e Express, e `mobile/`, o app em Expo e React Native, que também roda no navegador.

Este guia prepara o ambiente e roda as duas partes no seu computador. Para o resto, veja a [documentação da API](backend/docs/api.md), o [README do app](mobile/README.md) e o [guia de build e publicação](mobile/docs/build-e-publicacao.md).

## Pré-requisitos

- **Git**, para baixar o repositório.
- **Node.js**, com o npm que vem junto. O backend exige Node 20 ou superior, mas o app pede mais: o Expo SDK 58 e o React Native 0.88 aceitam Node 22.13 ou superior na versão 22, 24.3 ou superior na versão 24, ou 26 em diante. Use o Node 24, que é o do CI. Confira com `node -v`.
- **Onde abrir o app**: o navegador do computador, o emulador Android do Android Studio, o simulador iOS (só no macOS) ou o Expo Go num celular no mesmo Wi-Fi do computador.
- **PostgreSQL**, só para testar com banco. Sem ele, o backend guarda tudo em arquivos JSON locais.

## Baixar e instalar

```sh
git clone https://github.com/Dragoneto/Alexandria.git
cd Alexandria
git checkout dev
```

A `dev` é a branch de desenvolvimento, onde as mudanças entram antes de irem para a `main`. Instale as dependências das duas partes com `npm ci`, que usa exatamente as versões do `package-lock.json`:

```sh
cd backend
npm ci
cd ../mobile
npm ci
cd ..
```

## Subir o backend

Dentro de `backend/`, crie o seu `.env` a partir do modelo:

```sh
cd backend
cp .env.example .env
```

O `.env` fica só no seu computador (está no `.gitignore`). Abra o arquivo e troque o valor de `JWT_SECRET`, que assina os tokens de login, por um texto aleatório seu. Este comando gera um:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

O resto pode ficar como veio. Suba a API:

```sh
npm start
```

Ela está no ar quando o terminal mostra:

```text
🏛️ Alexandria API rodando em http://localhost:3000
💾 Persistência: local-file
```

Antes dessas linhas aparece um aviso de que a redefinição de senha está indisponível: sem e-mail configurado, é o esperado (veja [Redefinição de senha](#redefinição-de-senha)). `npm run dev` faz o mesmo que `npm start` e reinicia o backend quando um arquivo de código muda. Mudanças no `.env` só valem depois de reiniciar.

### Modo local (`DB_MODE=local`)

É o padrão do `.env.example`. O backend não precisa de banco: contas, avaliações, comentários, notificações e biblioteca ficam em arquivos JSON na pasta `backend/.data/`, que não vai para o git. Para começar do zero, pare o backend, apague a pasta `.data` e troque o `JWT_SECRET`: os ids recomeçam, e um token antigo abriria a conta nova que recebesse o mesmo id.

### Com PostgreSQL

Crie um banco vazio no seu PostgreSQL, por exemplo `alexandria`, e mude estas linhas do `backend/.env`:

```sh
DB_MODE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=seu_usuario
DB_PASSWORD=sua_senha
DB_NAME=alexandria
```

Troque `seu_usuario` e `sua_senha` pelos do seu PostgreSQL. Ao subir, o backend cria as tabelas que faltarem e mostra `💾 Persistência: postgres`, então não é preciso rodar nenhum SQL antes. Com esses campos, a conexão não usa SSL, a menos que `DB_SSL=true`.

Também dá para usar uma URL só, `DATABASE_URL=postgresql://usuario:senha@localhost:5432/alexandria`, no lugar dos campos `DB_*`. Com ela o SSL vem ligado: num PostgreSQL local, sem SSL, acrescente `DB_SSL=false`, senão o backend para com `The server does not support SSL connections`. Os dados do modo local não passam para o banco, porque são armazenamentos separados.

### Redefinição de senha

O backend manda o código de 6 dígitos por e-mail, pelo Brevo ou pelo Gmail; os campos estão explicados no `.env.example`. Sem e-mail, o pedido de código responde que a redefinição está indisponível. Para testar sem configurar e-mail, coloque `RESET_CODE_DEBUG=true` no `.env`, e o código aparece no terminal do backend. Use só no seu computador, nunca no servidor publicado.

## Subir o app

Em outro terminal, dentro de `mobile/`:

```sh
cd mobile
npm start
```

O Expo lê o `.env.development`, que aponta para o backend local em `http://localhost:3000`. No terminal dele, aperte `w` para abrir no navegador ou `a` para abrir no emulador Android. No celular, leia o QR code com o Expo Go.

### O endereço da API

O app procura o backend no endereço de `EXPO_PUBLIC_API_URL`. O padrão, `http://localhost:3000`, serve para o navegador e o simulador iOS. No emulador Android e no celular, `localhost` é o próprio aparelho, e o endereço muda:

| Onde o app roda | `EXPO_PUBLIC_API_URL` |
| --- | --- |
| Navegador ou simulador iOS | `http://localhost:3000` |
| Emulador Android | `http://10.0.2.2:3000` |
| Celular físico | `http://IP-DO-COMPUTADOR:3000` |

Para usar outro endereço, crie o seu `.env.local` em `mobile/` a partir do modelo e ajuste a linha da URL:

```sh
cp .env.example .env.local
```

```sh
EXPO_PUBLIC_API_URL=http://IP-DO-COMPUTADOR:3000
```

O `.env.local` vence o `.env.development`, fica só no seu computador e não interfere no `npm run start:prod`, que usa o backend publicado. Troque `IP-DO-COMPUTADOR` pelo IP do computador na rede, algo como `192.168.0.10`: no Windows ele aparece no `ipconfig`, no adaptador do Wi-Fi; no macOS, em `ipconfig getifaddr en0`; no Linux, em `hostname -I`. O celular precisa estar no mesmo Wi-Fi. A URL vai sem `/api` no final. Tudo que começa com `EXPO_PUBLIC_` fica dentro do app, então nunca coloque segredo nessas variáveis.

`EXPO_PUBLIC_API_TIMEOUT`, no mesmo arquivo, define quanto o app espera cada resposta, em milissegundos (padrão 15000). Depois de mudar qualquer variável, pare o Expo com `Ctrl+C` e rode `npm start` de novo. Ao subir, ele mostra quais arquivos leu, numa linha como `env: load .env.local .env.development`.

## Conferir se o app fala com a API

Com os dois no ar, abra `http://localhost:3000/api/health` no navegador do computador. A resposta deve ser `{"status":"ok","database":"local"}`, ou `postgres` no lugar de `local`. Se o app vai rodar no emulador ou no celular, abra no navegador do próprio aparelho o endereço do `EXPO_PUBLIC_API_URL` com `/api/health` no fim. Se ali não abrir, o problema é a rede ou o firewall, e não o app.

Depois, crie uma conta no app e entre com ela. Se a tela inicial abrir, o app falou com a API, porque o cadastro e o login passam pelo backend. No modo local, a conta nova aparece em `backend/.data/users.json`. As estantes da tela inicial vêm da Open Library, pela busca do backend: se elas mostrarem `Esta estante não carregou` com o login funcionando, a falha está entre o backend e a Open Library, e não entre o app e a API.

## Problemas comuns

### A API está fora do ar

O app mostra `Não foi possível conectar ao servidor. Verifique sua conexão.`, ou `O servidor demorou para responder. Tente novamente.` depois do tempo limite. Confira se o terminal do backend continua aberto, com a linha `Alexandria API rodando`, e se o `/api/health` abre no navegador do aparelho. No Windows, o firewall pode bloquear o Node: na primeira vez que o backend sobe, permita o acesso em redes privadas.

Se o backend nem sobe:

- `❌ Não foi possível iniciar a API: JWT_SECRET não configurado. Crie backend/.env antes de iniciar.`: falta o `backend/.env`, ou o comando rodou de outra pasta. O backend lê o `.env` da pasta onde é iniciado, então rode `npm start` de dentro de `backend/`.
- `EADDRINUSE: address already in use`: a porta 3000 já está em uso, em geral por outro backend aberto. Feche o outro ou mude `PORT` no `.env`, junto com a porta da URL do app.

### A URL do app está errada

- `localhost` no emulador ou no celular: o app procura o backend no próprio aparelho e mostra as mensagens de API fora do ar. Use o endereço da tabela.
- URL terminando em `/api`: o app soma o caminho das rotas e chama `/api/api/...`, que não existe. Aparece `Não foi possível concluir a solicitação (HTTP 404).`
- URL sem `http://`, ou com usuário e senha, `?` ou `#`: aparece `EXPO_PUBLIC_API_URL deve ser uma URL HTTP ou HTTPS válida.` ou `EXPO_PUBLIC_API_URL deve conter somente o endereço HTTP ou HTTPS da API.`

### As variáveis não foram carregadas

- O app continua com o endereço antigo: pare o Expo com `Ctrl+C`, rode `npm start` de novo, recarregue o app ou a página e confira na linha `env: load` se o `.env.local` foi lido.
- O `.env.local` precisa estar dentro de `mobile/`, e as variáveis do app precisam começar com `EXPO_PUBLIC_`.
- `Configure EXPO_PUBLIC_API_URL em mobile/.env.development (ou .env.local) e reinicie o Expo.`: a variável está vazia ou foi apagada.
- No backend, o `.env` precisa estar em `backend/` e só vale depois de reiniciar o backend.

### Erro em `expo/tsconfig.base`

O editor ou o TypeScript dizem que não acham `expo/tsconfig.base`. Esse arquivo vem do pacote `expo`, instalado em `mobile/node_modules`, então o erro aparece quando falta rodar `npm ci` em `mobile/`. Para conferir, dentro de `mobile/`:

```sh
node -p "require.resolve('expo/tsconfig.base')"
npm run typecheck
```

O primeiro comando mostra o caminho do arquivo quando o pacote está instalado. Se a linha de comando passa e o editor continua acusando o erro, confira se ele abriu a pasta do repositório e qual instalação de TypeScript está usando. Não copie o arquivo-base para o repositório nem remova o `extends` para esconder o aviso.
