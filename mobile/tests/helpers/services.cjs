const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const sourceRoot = path.resolve(__dirname, '../../src');
const compiled = new Map();

// Executa os serviços reais. Apenas rede e armazenamento da plataforma são substituídos.
function createServices({ os = 'android', storage = new Map(), env = {} } = {}) {
  const modules = new Map();
  const harness = {
    storage,
    env: { EXPO_PUBLIC_API_URL: 'http://localhost:3000/', ...env },
    requests: [],
    fetch: async () => {
      throw new Error('Requisição inesperada no teste');
    },
  };
  const secureStore = {
    getItemAsync: async (key) => storage.get(key) ?? null,
    setItemAsync: async (key, value) => {
      storage.set(key, value);
    },
    deleteItemAsync: async (key) => {
      storage.delete(key);
    },
  };
  const window = {
    sessionStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => {
        storage.set(key, value);
      },
      removeItem: (key) => {
        storage.delete(key);
      },
    },
  };
  function load(id) {
    if (id === 'expo-secure-store') return secureStore;
    if (id === 'react-native') return { Platform: { OS: os } };
    if (!id.startsWith('@/')) throw new Error(`Import inesperado: ${id}`);
    if (modules.has(id)) return modules.get(id).exports;
    const filename = path.join(sourceRoot, id.slice(2) + '.ts');
    if (!compiled.has(filename)) {
      compiled.set(
        filename,
        ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
          compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
        }).outputText,
      );
    }
    const module = { exports: {} };
    modules.set(id, module);
    const execute = new Function(
      'require',
      'module',
      'exports',
      'process',
      'fetch',
      'window',
      compiled.get(filename),
    );
    execute(
      load,
      module,
      module.exports,
      { env: harness.env },
      async (url, options) => {
        harness.requests.push({ url, ...options });
        return harness.fetch(url, options);
      },
      window,
    );
    return module.exports;
  }
  harness.api = load('@/services/api');
  harness.auth = load('@/services/auth');
  harness.books = load('@/services/open-library');
  harness.session = load('@/services/auth-storage');
  harness.config = load('@/constants/env');
  return harness;
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
const user = { id: 7, nome: 'Davi', email: 'davi@example.test' };
const session = { id: user.id, name: user.nome, email: user.email, token: 'token-do-backend' };
module.exports = { createServices, json, user, session };
