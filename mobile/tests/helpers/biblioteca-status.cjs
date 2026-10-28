const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Executa o handler real da tela; substitui somente estado, alertas e API.
const source = fs.readFileSync(path.resolve(__dirname, '../../src/app/(tabs)/biblioteca.tsx'), 'utf8');
const start = source.indexOf('  const handleStatusChange =');
const end = source.indexOf('  const handleFavorite =');
if (start < 0 || end <= start) throw new Error('Handler de status nao encontrado');
const code = ts.transpile(source.slice(start, end), { target: ts.ScriptTarget.ES2020 });
const create = new Function('items', 'setItems', 'setStatusModalItemId',
  'atualizarItemBiblioteca', 'Alert', 'ApiError', 'pendingStatus', 'setSavingStatusIds',
  code + '\nreturn handleStatusChange;');

module.exports = function harness() {
  const h = { items: [1, 2].map((id) => ({ id, statusLeitura: 'QUERO_LER' })), requests: [], saving: [], alerts: [] };
  const pending = { current: new Set() };
  const api = (id, body) => new Promise((resolve, reject) => h.requests.push({ id, body, resolve, reject }));
  h.render = () => create(h.items, (update) => { h.items = update(h.items); }, () => {}, api,
    { alert: (...args) => h.alerts.push(args) }, Error, pending, (ids) => { h.saving = ids; });
  return h;
};
