# Revisão técnica do Alexandria

Data da revisão: 22 de setembro de 2026

## Escopo

A revisão cobriu a configuração do aplicativo, cliente HTTP, autenticação, persistência de sessão, integração com a Open Library, telas relacionadas, dependências do mobile e dependências do backend.

## Correções realizadas

- Respostas inválidas ou nulas da Open Library agora são classificadas corretamente como erro do serviço.
- Valores inválidos para a quantidade total de resultados são descartados.
- A paginação é cancelada quando a tela é fechada, os filtros mudam ou uma nova busca começa.
- As dependências do aplicativo foram alinhadas às versões recomendadas pelo SDK 57 do Expo.
- O `bcrypt` do backend foi atualizado da versão 5 para a versão 6.
- O backend agora declara Node.js 18 ou superior como requisito.
- Foram adicionados testes para respostas nulas e totais inválidos da Open Library.

## Validações concluídas

- TypeScript: aprovado sem erros.
- ESLint: aprovado sem erros ou avisos.
- Testes automatizados: 21 de 21 aprovados.
- Exportação web: aprovada, com 14 rotas estáticas geradas.
- Compatibilidade das dependências do Expo: aprovada.
- Sintaxe dos arquivos JavaScript do backend: aprovada.
- Hash e comparação de senha com `bcrypt` 6: aprovados.
- Auditoria do backend: zero vulnerabilidades conhecidas.
- Autoria dos commits: `Davi Almeida <davi_almeida99@hotmail.com>`.

## Pontos pendentes

### Recuperação de senha

O backend atual não oferece a rota `POST /api/auth/forgot-password`. O aplicativo chama o endereço correto e informa ao usuário quando a função está indisponível, mas o fluxo só ficará completo após a implementação dessa rota no backend.

### Alertas transitivos do Expo

A auditoria do aplicativo ainda informa 14 ocorrências moderadas em dependências transitivas do Expo. A correção automática sugerida pelo npm exige versões incompatíveis do `expo-router` e do `expo-splash-screen`. A correção forçada não foi aplicada para evitar quebra do SDK atual.

### Teste integrado real

Os contratos de cadastro, login, perfil, sessão, logout e Open Library estão cobertos por testes automatizados. Ainda é necessário executar o fluxo completo em um aparelho ou emulador conectado ao backend e ao banco de dados reais.

## Commits da revisão

- `534eacd` — valida respostas externas da Open Library.
- `0537ae0` — cancela paginação obsoleta.
- `c9d766c` — cobre respostas inválidas em testes.
- `d6a229e` — alinha dependências do Expo.
- `9ea5d10` — atualiza o bcrypt e remove vulnerabilidades do backend.

Nenhuma alteração desta revisão foi enviada ao GitHub.
