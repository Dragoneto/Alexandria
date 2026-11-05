# Tema do Alexandria Mobile

A fonte única de cores é [`src/constants/design-system.ts`](../src/constants/design-system.ts). O [`src/constants/theme.ts`](../src/constants/theme.ts) não define cores próprias: ele só dá nomes de uso (`background`, `danger`...) aos tokens.

O `tests/tema.test.cjs` falha se alguém colocar uma cor fixa em uma tela ou deixar o tema divergir dos tokens.

## Como usar em uma tela nova

Use `useTheme()` e `ThemedText`, ou importe os tokens direto. Nunca escreva hexadecimal ou `rgba` na tela. Para uma versão transparente de uma cor, use `withAlpha`.

```tsx
import { Accent, Mint, withAlpha } from '@/constants/design-system';
import { useTheme } from '@/hooks/use-theme';

const theme = useTheme();

<ThemedText themeColor="textSecondary">Texto auxiliar pequeno</ThemedText>;
<View style={{ borderColor: theme.border }} />;
<View style={{ backgroundColor: withAlpha(Mint.mint400, 0.08) }} />;
<Text style={{ color: Accent.coral }}>Mensagem de erro</Text>;
```

`Spacing` (em `theme.ts`) e `Space` (em `design-system.ts`) usam os mesmos nomes para valores diferentes: `Spacing.three` é 16 e `Space.three` é 12. Confira qual deles o arquivo já usa antes de misturar.

## Cores do tema

| Chave em `theme.ts`  | Token                 | Valor     | Uso                                         |
| -------------------- | --------------------- | --------- | ------------------------------------------- |
| `text`               | `TextColor.primary`   | `#F1F5F9` | Texto principal                             |
| `textSecondary`      | `TextColor.secondary` | `#A9B7CE` | Texto de apoio e todo texto pequeno         |
| `textMuted`          | `TextColor.muted`     | `#6B7D99` | Placeholder e ícone (nunca abaixo de 16 px) |
| `background`         | `Ink.ink900`          | `#071324` | Fundo do app                                |
| `backgroundElement`  | `Ink.ink700`          | `#12213B` | Cartões e listas                            |
| `backgroundSelected` | `Ink.ink600`          | `#1A2B49` | Chips, sheets e campos                      |
| `accent`             | `Mint.mint400`        | `#5EEAD4` | Ação, marca e foco                          |
| `danger`             | `Accent.coral`        | `#F87171` | Erro                                        |
| `border`             | `Ink.ink500`          | `#26395C` | Bordas e divisores                          |

Os demais tokens (`Accent.sapphire`, `Accent.amber`, `Accent.laurel`, `Accent.lilac`, `Mint.mint200`, `Mint.mint500`, `Mint.mint900`, `Ink.ink800`) estão descritos nos comentários do próprio `design-system.ts`.

## Contraste medido

O mínimo para texto pequeno é 4,5:1 (WCAG AA).

| Cor                   | `ink900` | `ink800` | `ink700` | `ink600` |
| --------------------- | -------- | -------- | -------- | -------- |
| `TextColor.primary`   | 17,00    | 15,89    | 14,67    | 12,90    |
| `TextColor.secondary` | 9,18     | 8,58     | 7,92     | 6,97     |
| `TextColor.muted`     | 4,45     | 4,16     | 3,84     | 3,38     |
| `Mint.mint400`        | 12,59    | 11,77    | 10,87    | 9,56     |
| `Accent.coral`        | 6,73     | 6,29     | 5,81     | 5,11     |

`TextColor.muted` não atinge 4,5:1 em nenhum fundo. Por isso, ele fica restrito a placeholders de campos com 16 px ou mais e a ícones. Para texto com menos de 16 px, use `textSecondary`.

## Estados

| Estado       | Como aplicar                                                                                    |
| ------------ | ----------------------------------------------------------------------------------------------- |
| Erro         | `theme.danger` ou `Accent.coral`, na mensagem e na borda do campo                               |
| Foco         | Borda `Mint.mint400`. O `TextField` já faz isso; em um `TextInput` direto, use o hook `useFoco` |
| Desabilitado | `opacity: DisabledOpacity` junto com `disabled`, ou indicador de carregamento no lugar do texto |

```tsx
const { focado, propsDeFoco } = useFoco();

<TextInput {...propsDeFoco} style={{ borderColor: focado ? theme.accent : theme.border }} />;
<TouchableOpacity disabled={salvando} style={salvando && { opacity: DisabledOpacity }} />;
```

## Claro e escuro

O app só tem visual escuro: `Colors.light` e `Colors.dark` são a mesma paleta, o `app.json` usa `"userInterfaceStyle": "dark"` e o `_layout.tsx` usa sempre `DarkTheme`. Um tema claro exigiria uma nova paleta de tokens.

## Exceções

- **Véus pretos:** `rgba(0,0,0,...)` em modais e capas não tem token próprio.
- **Gradiente azul do `AnimatedIcon`:** esse componente não é usado por nenhuma tela.
- **`app.json`:** não importa tokens, então repete o valor de `Ink.ink900`. O teste confere se os dois continuam iguais.

## Verificação visual

Ao mudar um token, compare antes e depois no celular:

- [ ] **Login:** erro com senha errada, foco no campo e botão carregando.
- [ ] **Livro:** selos de categoria, descrição e botões desabilitados.
- [ ] **Biblioteca:** rótulos pequenos e botões enquanto salvam.
- [ ] **Conversa:** comentários, respostas e campo de texto.
