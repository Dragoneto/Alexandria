const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createServices } = require('./helpers/services.cjs');

function queue() {
  return createServices().messages.createMessageQueue();
}

test('cada tipo tem a sua duração, e o erro fica mais tempo', () => {
  const { MESSAGE_DURATION_MS } = createServices().messages;

  assert.deepEqual(MESSAGE_DURATION_MS, {
    success: 2000,
    info: 2000,
    warning: 2000,
    error: 4000,
  });

  const fila = queue();
  assert.equal(fila.push('success', 'Salvo.').durationMs, 2000);
  assert.equal(fila.push('error', 'Falhou.').durationMs, 4000);
});

test('a mensagem nova substitui a que estava na tela e avisa quem assinou', () => {
  const fila = queue();
  const vistas = [];
  fila.subscribe((message) => vistas.push(message?.text ?? null));

  fila.push('success', 'Perfil atualizado.');
  fila.push('error', 'Não foi possível salvar.');

  assert.equal(fila.current().text, 'Não foi possível salvar.');
  assert.equal(fila.current().kind, 'error');
  assert.deepEqual(vistas, ['Perfil atualizado.', 'Não foi possível salvar.']);
});

test('dispensar pelo id da mensagem atual limpa a tela', () => {
  const fila = queue();
  const mensagem = fila.push('info', 'Buscando livros.');

  fila.dismiss(mensagem.id);

  assert.equal(fila.current(), null);
});

test('o fim da contagem de uma mensagem antiga não derruba a nova', () => {
  const fila = queue();
  const antiga = fila.push('success', 'Perfil atualizado.');
  const nova = fila.push('error', 'Não foi possível salvar.');

  fila.dismiss(antiga.id);

  assert.equal(fila.current().id, nova.id);
});

test('texto vazio ou só espaço não vira mensagem', () => {
  const fila = queue();

  assert.equal(fila.push('success', '   '), null);
  assert.equal(fila.current(), null);

  const mensagem = fila.push('success', '  Perfil atualizado.  ');
  assert.equal(mensagem.text, 'Perfil atualizado.');
  assert.equal(fila.push('info', ''), mensagem);
  assert.equal(fila.current().id, mensagem.id);
});

test('quem cancela a assinatura para de receber', () => {
  const fila = queue();
  const vistas = [];
  const cancelar = fila.subscribe((message) => vistas.push(message));

  fila.push('success', 'Primeira.');
  cancelar();
  fila.push('success', 'Segunda.');

  assert.equal(vistas.length, 1);
  assert.equal(fila.current().text, 'Segunda.');
});
