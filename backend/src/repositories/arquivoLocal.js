const fs = require('node:fs/promises');
const { setTimeout: esperar } = require('node:timers/promises');

// No Windows o rename falha enquanto outra requisição está lendo o arquivo de destino.
// A leitura termina logo, então basta tentar de novo; qualquer outro erro é falha de verdade
const ARQUIVO_OCUPADO = new Set(['EPERM', 'EACCES', 'EBUSY']);
const TENTATIVAS = 20;

async function substituirArquivo(origem, destino) {
  for (let tentativa = 1; ; tentativa += 1) {
    try {
      await fs.rename(origem, destino);
      return;
    } catch (error) {
      if (!ARQUIVO_OCUPADO.has(error.code) || tentativa === TENTATIVAS) throw error;
      await esperar(tentativa * 5);
    }
  }
}

module.exports = { substituirArquivo };
