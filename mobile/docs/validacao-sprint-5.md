# Validação da comunicação entre leitores

Registro da issue #169: o fluxo de conversa testado de ponta a ponta antes de fechar a Sprint 5, com o que foi visto no navegador, o que foi visto no celular e o que ficou de fora.

## Testes automáticos

Os cenários `fluxo entre leitores (#169)` ficam em `backend/tests/persistencia/cenarios.js` e rodam pela API real, no JSON local (`npm test`) e no PostgreSQL descartável (`node scripts/postgres-de-teste.js`):

- Ana avalia, Bia acha a avaliação pelo livro e comenta, Ana responde e Bia responde à resposta.
- As duas leem a conversa, mas só podem editar e excluir os próprios comentários: tentar mexer no da outra dá 403.
- Excluir o comentário pai mantém as respostas, e o pai volta como removido, sem texto. Responder a ele dá 409.
- Excluir a avaliação faz a conversa responder 404, sem deixar comentário órfão.
- Texto vazio, só espaços ou com 2001 caracteres dá 400, e com 2000 passa. Identificador inválido dá 400, e pai de outra avaliação dá 404.
- Token expirado ou ausente dá 401.
- Dois envios simultâneos e uma nova tentativa com a mesma `Idempotency-Key` gravam um comentário só.

## Navegador

Em 05/11/2026, no app web exportado (`npx expo export --platform web`) com o backend local em modo JSON. Ana e Bia ficaram cada uma numa aba, já que a sessão do web fica na aba.

| Passo                                                            | Resultado                                                                            |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Cadastro e login das duas contas                                 | ok                                                                                   |
| Ana publica a avaliação pela tela do livro                       | ok, o botão vira "Editar minha avaliação"                                            |
| Bia abre o livro, toca na avaliação e comenta                    | ok                                                                                   |
| Clique duplo no Enviar                                           | um comentário só                                                                     |
| Ana vê o comentário da Bia só com "Responder" e responde         | ok                                                                                   |
| Bia atualiza, abre "Ver 1 resposta" e responde à Ana             | ok                                                                                   |
| Envio com a rede atrasada em 2,5 s e três cliques no Enviar      | botão ocupado, campo travado, uma resposta só                                        |
| Bia exclui o próprio comentário                                  | vira "Comentário removido" e as respostas continuam                                  |
| Ana exclui a avaliação em Minhas avaliações com a Bia escrevendo | a tela da Bia mostra "Avaliação não encontrada" e o texto não enviado, com Descartar |
| Biblioteca: adicionar e trocar status pela tela do livro         | ok                                                                                   |
| Favoritos: favoritar e filtrar na Biblioteca                     | ok                                                                                   |
| Sessão expirada (token inválido)                                 | volta para a tela inicial e a sessão sai do aparelho                                 |
| Sair da conta com rascunho salvo                                 | os rascunhos são apagados                                                            |

Paginação e rascunhos também foram testados no navegador quando entraram (#168 e #173): várias páginas, falha de rede sem perder o que estava na tela, reinício, troca de conta e alvo removido.

## Celular

Em 05/11/2026, num celular Android com Expo Go, com o backend no computador e o app apontando para o IP dele na rede (`.env.local`).

| Passo                                               | Resultado |
| --------------------------------------------------- | --------- |
| Login                                               | ok        |
| Abrir o livro e a conversa                          | ok        |
| Comentar e responder                                | ok        |
| Teclado não cobre o campo de texto                  | ok        |
| Rascunho volta depois de fechar e abrir o app       | ok        |
| Sem internet: o texto fica e dá para tentar de novo | ok        |
| Sair da conta apaga o rascunho                      | ok        |

## Limitações

- iPhone e emulador não foram testados. No Android, o fluxo foi testado com uma conta só.
- Rede lenta foi simulada atrasando as requisições no navegador, não com uma rede ruim de verdade.
- No navegador, recarregar a página menos de meio segundo depois de digitar pode perder as últimas letras do rascunho.
- O servidor de desenvolvimento do Expo para web (`expo start --web`) ficou sem memória nesta máquina, por isso o navegador usou o app exportado.
- O teste de cores do tema (`tema.test.cjs`) falha no `dev` por uma cor fixa em `app/notificacoes.tsx`, fora da conversa.
