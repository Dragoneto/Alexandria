const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

const fonte = fs
  .readFileSync(path.resolve(__dirname, '../src/app/(tabs)/biblioteca.tsx'), 'utf8')
  .split('\r\n')
  .join('\n');

const botoes = fonte
  .split('<TouchableOpacity')
  .slice(1)
  .map((trecho) => trecho.split('</TouchableOpacity>')[0]);

// Executa as funções reais de aviso; substitui somente estado e plataforma.
function criarAvisos(os) {
  const inicio = fonte.indexOf('  const avisar =');
  const fim = fonte.indexOf('  const handleStatusChange =');
  assert.ok(inicio >= 0 && fim > inicio, 'funções de aviso não encontradas');
  const codigo = ts.transpile(fonte.slice(inicio, fim), { target: ts.ScriptTarget.ES2020 });
  const registro = { aviso: '', anuncios: [], alertas: [] };
  const { avisar, avisarErro } = new Function(
    'setAviso',
    'Platform',
    'AccessibilityInfo',
    'Alert',
    `${codigo}\nreturn { avisar, avisarErro };`,
  )(
    (texto) => {
      registro.aviso = texto;
    },
    { OS: os },
    { announceForAccessibility: (texto) => registro.anuncios.push(texto) },
    { alert: (...args) => registro.alertas.push(args) },
  );
  return { avisar, avisarErro, registro };
}

test('todo botão da Biblioteca tem papel e rótulo', () => {
  assert.ok(botoes.length >= 5);
  for (const botao of botoes) {
    assert.match(botao, /accessibilityRole=/);
    assert.match(botao, /accessibilityLabel=/);
  }
});

test('filtros e opções do modal expõem a seleção sem depender só da cor', () => {
  const radios = botoes.filter((botao) => botao.includes('accessibilityRole="radio"'));
  assert.equal(radios.length, 2);
  for (const radio of radios) {
    assert.match(radio, /aria-checked=\{/);
    // O ícone de check marca a opção escolhida, além da cor
    assert.match(radio, /ios: 'checkmark'/);
  }
});

test('status e favoritar expõem desabilitado e ocupado', () => {
  for (const marca of ['Status de leitura de', "'Favorito' : 'Favoritar'"]) {
    const botao = botoes.find((item) => item.includes(marca));
    assert.ok(botao, marca);
    assert.match(botao, /aria-disabled=\{/);
    assert.match(botao, /aria-busy=\{/);
  }
});

test('ações internas não ficam dentro de um elemento tocável', () => {
  assert.match(fonte, /<ThemedView key=\{item\.id\}/);
  assert.match(fonte, /<View style=\{styles\.modalOverlay\}>/);
  assert.match(fonte, /accessibilityLabel="Fechar"[\s\S]*?\/>\s*<ThemedView/);
  for (const botao of botoes) {
    assert.doesNotMatch(botao, /<(TouchableOpacity|Pressable)\b/);
  }
});

test('opções do modal respeitam o alvo mínimo de toque', () => {
  assert.match(fonte, /modalOption: \{[^}]*minHeight: TouchMin/);
});

test('o texto acompanha o tamanho de fonte do aparelho', () => {
  assert.doesNotMatch(fonte, /allowFontScaling=\{false\}/);
});

test('carregamento, erro e aviso são anunciados', () => {
  assert.match(fonte, /<ThemedText\s+accessibilityLiveRegion="polite"[^>]*styles\.aviso/);
  assert.match(fonte, /<ThemedView\s+accessibilityLiveRegion="polite"/);
  assert.match(fonte, /<ErrorState\s+message=\{erro\}/);
  const errorState = fs.readFileSync(path.resolve(__dirname, '../src/components/error-state.tsx'), 'utf8');
  assert.match(errorState, /accessibilityRole="alert"/);
});

for (const [os, anuncios] of [
  ['ios', ['Salvo']],
  ['android', []],
  ['web', []],
]) {
  test(`${os}: o aviso aparece na tela e usa o anúncio direto só quando precisa`, () => {
    const { avisar, registro } = criarAvisos(os);
    avisar('Salvo');
    assert.equal(registro.aviso, 'Salvo');
    assert.deepEqual(registro.anuncios, anuncios);
  });
}

test('web: o erro aparece no aviso, porque lá o Alert não faz nada', () => {
  const { avisarErro, registro } = criarAvisos('web');
  avisarErro('Não foi possível remover', 'Sem conexão.');
  assert.equal(registro.aviso, 'Não foi possível remover. Sem conexão.');
  assert.deepEqual(registro.alertas, []);
});

test('celular: o erro continua no Alert', () => {
  const { avisarErro, registro } = criarAvisos('android');
  avisarErro('Não foi possível remover', 'Sem conexão.');
  assert.equal(registro.aviso, '');
  assert.deepEqual(registro.alertas, [['Não foi possível remover', 'Sem conexão.']]);
});
