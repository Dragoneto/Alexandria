# Acessibilidade da Biblioteca

Registro da issue #164: o que a tela expõe, como foi verificado e o que ainda não foi validado em aparelho.

## O que a tela expõe

| Controle         | Papel        | Rótulo                                             | Estado                                        |
| ---------------- | ------------ | -------------------------------------------------- | --------------------------------------------- |
| Grupo de filtros | `radiogroup` | Filtrar livros por status                          | -                                             |
| Filtro           | `radio`      | Filtrar por Lendo                                  | `aria-checked`                                |
| Status           | `button`     | Status de leitura de Dom Casmurro: Lendo. Alterar  | `aria-disabled` e `aria-busy` enquanto salva  |
| Favoritar        | `button`     | Favoritar: Dom Casmurro, ou Favorito: Dom Casmurro | `aria-selected`, `aria-disabled`, `aria-busy` |
| Remover          | `button`     | Remover Dom Casmurro da biblioteca                 | -                                             |
| Fundo do modal   | `button`     | Fechar                                             | -                                             |
| Opção do modal   | `radio`      | Lendo                                              | `aria-checked`                                |

Avisos de salvamento aparecem em texto, em uma região ao vivo (`accessibilityLiveRegion`). No iOS, que não tem região ao vivo, a tela usa `AccessibilityInfo.announceForAccessibility`.

Erros de ação usam `Alert.alert` no celular. No web, onde `Alert.alert` não faz nada, eles aparecem no mesmo aviso em texto.

## Regras para telas novas

- **Estado:** use `aria-checked`, `aria-selected`, `aria-disabled` e `aria-busy`. O `accessibilityState` funciona no celular, mas o `react-native-web` o ignora, então o estado não chega ao navegador.
- **Botões dentro de botões:** não coloque um elemento tocável dentro de outro. O leitor de tela pode não alcançar o interno, e um toque pode acionar o externo. Deixe os dois lado a lado.
- **Seleção:** não indique seleção só pela cor. Os filtros e as opções do modal usam ✓.
- **Fonte:** não use `allowFontScaling={false}`.
- **Alvo de toque:** use `TouchMin` (44 px) como altura mínima.

## Verificado no navegador

Chrome sem interface, com a API simulada, em 05/11/2026. Resultados obtidos na versão web, não em aparelho.

| Item                   | Resultado                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------- |
| Nomes, papéis, estados | Filtros, status, favoritar, remover e modal expostos como na tabela acima           |
| Ordem de foco          | Filtros e, em cada livro, status, favoritar e remover                               |
| Teclado                | `Enter` aciona tudo; `Espaço` aciona botões; `Esc` fecha o modal                    |
| Foco no modal          | Fica preso no modal e volta ao botão de status ao fechar                            |
| Avisos                 | Sucesso e erro aparecem em texto, em região ao vivo                                 |
| Alvos de toque         | Filtros, status, favoritar e remover com 46 px de altura; opções do modal com 44 px |
| Janela de 210 px       | Equivale a zoom de 200%: nenhum texto cortado nos botões e sem rolagem horizontal   |
| Contraste              | Entre 5,81:1 (Remover) e 12,59:1 (filtro selecionado); mínimo exigido de 4,5:1      |

## Limitações

### Ainda não validado em aparelho

- [ ] **TalkBack (Android):** ordem de leitura, nomes, estados, opções do modal e avisos.
- [ ] **VoiceOver (iOS):** os mesmos itens. Exige um iPhone.
- [ ] **Fonte ampliada no aparelho:** a janela de 210 px simula o zoom do navegador, não a fonte do sistema.
- [ ] **Alvos de toque no aparelho:** as medidas acima vêm do navegador.
- [ ] **Leitura do `Alert.alert` pelo leitor de tela.**

### Comportamento conhecido no web

- **Remover não funciona:** a confirmação usa `Alert.alert`, que não faz nada no web. O livro não é removido. A correção precisa de outra forma de confirmar e deve ser tratada em uma issue própria.
- **Filtros e opções do modal aceitam `Enter`, mas não `Espaço` nem setas:** o `react-native-web` só aceita `Espaço` no papel `button`. Cada opção é alcançada com `Tab`.

### Outras telas

Os filtros de Explorar ainda não têm papel nem estado, e outras telas usam `accessibilityState`, que não chega ao navegador. Isso fica fora da #164, que trata só da Biblioteca.
