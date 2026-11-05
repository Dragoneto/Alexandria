// Cenários de docs/testes-persistencia.md no JSON local. As variáveis precisam existir antes de carregar src/.
const fs = require('node:fs');
const path = require('node:path');

const { criarAmbienteLocal } = require('./persistencia/ambiente');

const ambiente = criarAmbienteLocal();

const assert = require('node:assert/strict');
const { describe, test } = require('node:test');
const { definirCenarios } = require('./persistencia/cenarios');

const PASTA_REAL = path.resolve(__dirname, '../.data');

function retratoDaPastaReal() {
  if (!fs.existsSync(PASTA_REAL)) return [];
  return fs.readdirSync(PASTA_REAL).map((nome) => {
    const { mtimeMs, size } = fs.statSync(path.join(PASTA_REAL, nome));
    return [nome, mtimeMs, size];
  });
}

const retratoInicial = retratoDaPastaReal();

definirCenarios(ambiente, (contexto) => {
  describe('isolamento do JSON local', () => {
    test('grava só na pasta temporária: backend/.data não é tocada', async () => {
      await contexto().f.novaConversa();

      assert.ok(fs.statSync(path.join(ambiente.pasta, 'comentarios.json')).size > 0);
      assert.deepEqual(retratoDaPastaReal(), retratoInicial);
    });
  });
});
