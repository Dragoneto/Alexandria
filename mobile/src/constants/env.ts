// Acesso literal exigido pelo Expo para substituir as variáveis durante o build.
// Validar na requisição permite mostrar erros sem impedir o app de abrir.
export function getApiConfig() {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!configuredUrl) {
    throw new Error('Configure EXPO_PUBLIC_API_URL em mobile/.env.local e reinicie o Expo.');
  }
  let url: URL;
  try {
    url = new URL(configuredUrl);
  } catch {
    throw new Error('EXPO_PUBLIC_API_URL deve ser uma URL HTTP ou HTTPS válida.');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error('EXPO_PUBLIC_API_URL deve conter somente o endereço HTTP ou HTTPS da API.');
  }
  const timeout = Number(process.env.EXPO_PUBLIC_API_TIMEOUT);
  return {
    baseUrl: url.toString().replace(/\/+$/, ''),
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : 15000,
  };
}
