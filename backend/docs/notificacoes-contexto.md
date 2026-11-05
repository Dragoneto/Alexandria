# Notificações e contexto — #174 e #176

Implementação baseada na dev 8ef1e72, incluindo os PRs #185, #187 e #189 de comentários.
Os contratos abaixo precisam ser revisados pela equipe antes da integração, conforme #160.

## Notificações (#174)

Todas as rotas exigem Bearer token. O destinatário é sempre o usuário autenticado.

| Método e caminho | Resposta |
| --- | --- |
| GET `/api/notificacoes?limit=20&cursor=...` | `{ notificacoes, proximoCursor }` |
| GET `/api/notificacoes/nao-lidas` | `{ total }` |
| PATCH `/api/notificacoes/:id/lida` | `{ atualizadas }` |
| PATCH `/api/notificacoes/lidas` | `{ atualizadas }` |

O limite é de 1 a 50. Cursor ordena por data e UUID, ambos decrescentes.
Item: `id`, `tipo`, `autor: { id, nome }`, `avaliacaoId`, `comentarioId`, `eventoId`,
`criadoEm`, `lidaEm` e `alvoDisponivel`. Não contém e-mail, senha ou texto da mensagem.
Marcar uma como lida é idempotente; item alheio/inexistente retorna 404. Entrada inválida retorna 400.

Comentário avisa o autor da avaliação. Resposta avisa também o autor do pai;
se forem a mesma pessoa, recebe apenas uma notificação do tipo resposta. Não há autonotificação.
Reenvio com a Idempotency-Key do #189 reaproveita o comentário e não cria outro evento.
Sem chave, dois POSTs são duas mensagens, conforme o contrato existente.
Mensagens anteriores a esta implementação não geram notificações retroativas.

PostgreSQL grava comentário e notificações na mesma transação. Falha desfaz ambos.
No modo local, `notification_events` fica no mesmo JSON do comentário, gravado atomicamente.
A inicialização e as consultas de notificações recuperam eventos ainda não materializados,
deduplicando por evento/destinatário. O evento permanece no comentário para permitir recuperação.
A exclusão em cascata materializa os eventos antes de remover os comentários do arquivo.
`LOCAL_NOTIFICATIONS_FILE` pode isolar o armazenamento; por padrão acompanha a pasta de comentários.
O modo JSON continua destinado a um processo local; múltiplas instâncias devem usar PostgreSQL.

Notificações sobrevivem à remoção do alvo, com `alvoDisponivel=false`.
O UUID do evento distingue comentários que reutilizem o mesmo ID no modo local.
Sem push, e-mail, WebSocket ou consulta periódica em segundo plano.

## Contexto (#176)

GET autenticado `/api/avaliacoes/:id/comentarios/:comentarioId/contexto` aceita
`eventoId` (identidade da notificação) e `apos` (cursor numérico da página seguinte).
Retorna `avaliacaoId`, `livroId`, `comentarioId`, `alvo`, `ancestrais`, `comentarios`,
`proximoCursor` e `ancestralAnteriorId`. Usa o formato público de comentário do #167.

A primeira página começa no alvo e contém até 20 comentários da avaliação por ID crescente.
São retornados até 50 ancestrais; se houver mais, `ancestralAnteriorId` permite abrir o contexto anterior.
Não carrega toda a conversa no mobile. No PostgreSQL a página usa consulta com limite;
no JSON o arquivo ainda é lido integralmente, como nos demais repositórios locais.
Alvo de outra avaliação/identidade retorna 404; removido, 410; ciclo detectado, 409.

A rota mobile `/comentario/:id?avaliacaoId=...&eventoId=...` é protegida pela sessão,
mostra o alvo em primeiro lugar, destaca por cinco segundos e oferece retorno ao livro,
ancestrais e paginação. Requisições são canceladas ao sair/trocar de alvo.
`destinoDaNotificacao()` constrói a navegação e recusa alvo indisponível.

## Integrações ainda pendentes

A central #175 deve chamar `destinoDaNotificacao()` ao selecionar uma notificação.
Esta entrega não implementa a central nem o editor geral da conversa #130.
O endpoint de contexto é adicional: a listagem existente não mudou. Alinhar com #168
antes de unificar a paginação geral. #176 não deve ser encerrado antes do teste pela central
e da revisão conjunta com a tela de conversa, incluindo teste em aparelho.

## Verificação desta entrega

- Backend completo: 156 testes aprovados, zero falhas efetivas, dois skips e cinco TODOs.
- A suíte existente mantém como TODO a corrida de reutilização do ID da avaliação no JSON;
  esse caso conhecido não equivale a aprovação. O evento protege links antigos de notificações.
- Mobile: 111 testes aprovados; lint dos novos arquivos aprovado.
- Exportação web concluída com a nova rota; não substitui teste visual em aparelho.
- Tipos: os mesmos seis erros em abas, busca e navegação web também aparecem na dev intacta
  com as dependências do SDK 58. Nenhum erro adicional nos arquivos desta entrega.
- PostgreSQL real foi testado em banco temporário, incluindo rollback, reenvio concorrente,
  leitura privada, paginação, contexto e regressões da suíte de conversas.

Executar no backend `node scripts/postgres-de-teste.js tests/conversas-postgres.test.js tests/notificacoes-postgres.test.js`
para repetir o teste de PostgreSQL isolado. O script exige PostgreSQL já instalado.
