// A suíte de persistência apaga dados. Esta trava decide se o banco informado pode mesmo ser usado:
// na dúvida ela recusa, e as mensagens nunca citam a URL inteira, porque ela traz a senha.
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');

const ENDERECOS_LOCAIS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function destinoDaUrl(url) {
  let partes;
  try {
    partes = new URL(url);
  } catch {
    throw new Error('TEST_DATABASE_URL não é uma URL válida.');
  }
  if (partes.protocol !== 'postgres:' && partes.protocol !== 'postgresql:') {
    throw new Error('TEST_DATABASE_URL precisa começar com postgresql://.');
  }
  return {
    host: partes.hostname,
    porta: partes.port || '5432',
    banco: decodeURIComponent(partes.pathname.slice(1)),
  };
}

const ehLocal = (host) => ENDERECOS_LOCAIS.has(host);
const hostComparavel = (host) => (ehLocal(host) ? 'local' : host.toLowerCase());
const mesmoDestino = (a, b) =>
  hostComparavel(a.host) === hostComparavel(b.host) && a.porta === b.porta && a.banco === b.banco;

/** Os bancos que a aplicação usaria com esta configuração, por DATABASE_URL ou por DB_HOST e companhia. */
function destinosDaConfiguracao(variaveis) {
  const destinos = [];
  if (variaveis.DATABASE_URL) {
    try {
      destinos.push(destinoDaUrl(variaveis.DATABASE_URL));
    } catch {
      // URL quebrada na configuração não aponta para banco nenhum
    }
  }
  if (variaveis.DB_HOST && variaveis.DB_NAME) {
    destinos.push({ host: variaveis.DB_HOST, porta: variaveis.DB_PORT || '5432', banco: variaveis.DB_NAME });
  }
  return destinos;
}

function lerArquivoEnv(arquivo = path.resolve(__dirname, '../../.env')) {
  try {
    return dotenv.parse(fs.readFileSync(arquivo));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

/**
 * Lança erro se a URL não for de um banco claramente de teste: fora de produção, com "test" no nome,
 * local (ou liberado de propósito) e diferente de qualquer banco configurado para a aplicação.
 */
function validarBancoDeTeste(url, { ambiente = process.env, arquivoEnv = lerArquivoEnv() } = {}) {
  if (ambiente.NODE_ENV === 'production') {
    throw new Error('Os testes de persistência não rodam com NODE_ENV=production.');
  }

  const destino = destinoDaUrl(url);
  if (!/test/i.test(destino.banco)) {
    throw new Error(`O banco "${destino.banco}" não parece de teste: o nome precisa conter "test".`);
  }
  if (!ehLocal(destino.host) && ambiente.TEST_DATABASE_PERMITIR_REMOTO !== 'true') {
    throw new Error(
      `O host "${destino.host}" não é local. Se for mesmo um banco descartável, defina TEST_DATABASE_PERMITIR_REMOTO=true.`,
    );
  }

  const configurados = [...destinosDaConfiguracao(ambiente), ...destinosDaConfiguracao(arquivoEnv)];
  if (configurados.some((configurado) => mesmoDestino(configurado, destino))) {
    throw new Error('TEST_DATABASE_URL aponta para o banco que a aplicação usa (DATABASE_URL ou DB_*).');
  }

  return destino;
}

module.exports = { validarBancoDeTeste };
