const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { test } = require('node:test');

const { substituirArquivo } = require('../src/repositories/arquivoLocal');

const falha = (code) => Object.assign(new Error(code), { code });

// O bloqueio só acontece no Windows: o rename falso prova a mesma regra em qualquer sistema, inclusive no CI
test('tenta de novo enquanto o arquivo está ocupado por uma leitura', async (t) => {
  for (const codigo of ['EPERM', 'EACCES', 'EBUSY']) {
    let chamadas = 0;
    const rename = t.mock.method(fs, 'rename', async () => {
      chamadas += 1;
      if (chamadas < 3) throw falha(codigo);
    });

    await substituirArquivo('origem.tmp', 'destino.json');

    assert.equal(chamadas, 3);
    assert.deepEqual(rename.mock.calls[0].arguments, ['origem.tmp', 'destino.json']);
    rename.mock.restore();
  }
});

test('não insiste em erro que não é de arquivo ocupado', async (t) => {
  const rename = t.mock.method(fs, 'rename', async () => {
    throw falha('ENOSPC');
  });

  await assert.rejects(substituirArquivo('origem.tmp', 'destino.json'), { code: 'ENOSPC' });
  assert.equal(rename.mock.callCount(), 1);
});

test('desiste e devolve o erro se o arquivo continuar ocupado', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const rename = t.mock.method(fs, 'rename', async () => {
    t.mock.timers.tick(1000); // as esperas entre as tentativas passam na hora
    throw falha('EPERM');
  });

  await assert.rejects(substituirArquivo('origem.tmp', 'destino.json'), { code: 'EPERM' });
  assert.equal(rename.mock.callCount(), 20);
});
