const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

const raiz = path.resolve(__dirname, '..');
const pastaSrc = path.join(raiz, 'src');

function ler(relativo) {
  return fs.readFileSync(path.join(pastaSrc, relativo), 'utf8');
}

// Executa o módulo real. Apenas as dependências da plataforma são substituídas.
function carregar(relativo, dependencias) {
  const saida = ts.transpileModule(ler(relativo), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const modulo = { exports: {} };
  new Function('module', 'exports', 'require', saida)(modulo, modulo.exports, (id) => {
    if (id in dependencias) return dependencias[id];
    throw new Error(`Import inesperado: ${id}`);
  });
  return modulo.exports;
}

const reactNative = { Platform: { select: (opcoes) => opcoes.default } };
const ds = carregar('constants/design-system.ts', { 'react-native': reactNative });
const { Colors } = carregar('constants/theme.ts', {
  'react-native': reactNative,
  '@/constants/design-system': ds,
  '@/global.css': {},
});

function arquivosFonte(pasta = pastaSrc) {
  return fs.readdirSync(pasta, { withFileTypes: true }).flatMap((item) => {
    const caminho = path.join(pasta, item.name);
    if (item.isDirectory()) return arquivosFonte(caminho);
    return /\.tsx?$/.test(item.name) ? [caminho] : [];
  });
}

function nomeRelativo(caminho) {
  return path.relative(pastaSrc, caminho).split(path.sep).join('/');
}

function luminancia(hex) {
  const [r, g, b] = [1, 3, 5]
    .map((inicio) => parseInt(hex.slice(inicio, inicio + 2), 16) / 255)
    .map((canal) => (canal <= 0.03928 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a, b) {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (escuro + 0.05);
}

test('cada cor do tema aponta para o token do design system', () => {
  assert.deepEqual(Colors.dark, {
    text: ds.TextColor.primary,
    textSecondary: ds.TextColor.secondary,
    textMuted: ds.TextColor.muted,
    background: ds.Ink.ink900,
    backgroundElement: ds.Ink.ink700,
    backgroundSelected: ds.Ink.ink600,
    accent: ds.Mint.mint400,
    danger: ds.Accent.coral,
    border: ds.Ink.ink500,
  });
  assert.deepEqual(Colors.light, Colors.dark);
});

test('theme.ts não define cores próprias', () => {
  assert.doesNotMatch(ler('constants/theme.ts'), /#[0-9a-fA-F]{3,8}\b|rgba?\(/);
});

test('não há cores fixas fora do design system', () => {
  // Véus pretos não têm token, e o gradiente pertence ao AnimatedIcon, que nenhuma tela usa.
  const permitidas = [/^rgba\(0, ?0, ?0, ?[\d.]+\)$/, /^#3C9FFE$/i, /^#0274DF$/i];
  const encontradas = arquivosFonte()
    .filter((caminho) => nomeRelativo(caminho) !== 'constants/design-system.ts')
    .flatMap((caminho) => {
      const cores = fs.readFileSync(caminho, 'utf8').match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g);
      return (cores ?? [])
        .filter((cor) => !permitidas.some((permitida) => permitida.test(cor)))
        .map((cor) => `${nomeRelativo(caminho)}: ${cor}`);
    });
  assert.deepEqual(encontradas, []);
});

test('texto e estados têm contraste de 4,5:1 em todas as superfícies', () => {
  const superficies = [ds.Ink.ink900, ds.Ink.ink800, ds.Ink.ink700, ds.Ink.ink600];
  const textos = {
    primario: ds.TextColor.primary,
    secundario: ds.TextColor.secondary,
    acao: ds.Mint.mint400,
    erro: ds.Accent.coral,
  };
  for (const [nome, cor] of Object.entries(textos)) {
    for (const superficie of superficies) {
      assert.ok(contraste(cor, superficie) >= 4.5, `${nome} sobre ${superficie}`);
    }
  }
  assert.ok(contraste(ds.Ink.ink900, ds.Mint.mint400) >= 4.5, 'texto do botão primário');
});

test('a cor auxiliar não aparece em texto com menos de 16 px', () => {
  const problemas = arquivosFonte().flatMap((caminho) => {
    const fonte = fs.readFileSync(caminho, 'utf8');
    const achados = [];
    if (fonte.includes('themeColor="textMuted"')) {
      achados.push(`${nomeRelativo(caminho)}: themeColor="textMuted"`);
    }
    for (const [, nome, corpo] of fonte.matchAll(/(\w+):\s*\{([^{}]*)\}/g)) {
      if (!/color:\s*(TextColor\.muted|theme\.textMuted)/.test(corpo)) continue;
      const tamanho = Number(corpo.match(/fontSize:\s*([\d.]+)/)?.[1] ?? 0);
      if (tamanho < 16) achados.push(`${nomeRelativo(caminho)}: ${nome}`);
    }
    return achados;
  });
  assert.deepEqual(problemas, []);
});

test('o app abre e permanece no tema escuro', () => {
  const { expo } = JSON.parse(fs.readFileSync(path.join(raiz, 'app.json'), 'utf8'));
  const splash = expo.plugins.find((item) => item[0] === 'expo-splash-screen')[1];
  assert.equal(expo.userInterfaceStyle, 'dark');
  assert.equal(expo.android.adaptiveIcon.backgroundColor, ds.Ink.ink900);
  assert.equal(splash.backgroundColor, ds.Ink.ink900);
  assert.match(ler('app/_layout.tsx'), /<ThemeProvider value=\{DarkTheme\}>/);
});

test('todo campo de texto mostra quando está em foco', () => {
  const semFoco = arquivosFonte()
    .filter((caminho) => nomeRelativo(caminho) !== 'components/text-field.tsx')
    .filter((caminho) => {
      const fonte = fs.readFileSync(caminho, 'utf8');
      return fonte.includes('<TextInput') && !fonte.includes('{...propsDeFoco}');
    })
    .map(nomeRelativo);
  assert.deepEqual(semFoco, []);
});

test('useFoco liga e desliga o foco', () => {
  let estado = false;
  const { useFoco } = carregar('hooks/use-foco.ts', {
    react: { useState: () => [estado, (valor) => (estado = valor)] },
  });
  const { propsDeFoco } = useFoco();
  propsDeFoco.onFocus();
  assert.equal(estado, true);
  propsDeFoco.onBlur();
  assert.equal(estado, false);
});
