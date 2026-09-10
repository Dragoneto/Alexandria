/**
 * Configuração de ambiente do app.
 *
 * A URL da API vem de EXPO_PUBLIC_API_URL, definida em .env.development (mock,
 * usado pelo npm start) ou .env.production (Railway, usado pelo
 * npm run start:railway e pelos builds). Veja "Ambientes da API" no README.
 */

/** URL base da API, sem barra no final, ou null quando não está configurada. */
export function getApiUrl(): string | null {
  // O Expo só troca a variável quando ela aparece escrita por extenso
  const configured = process.env.EXPO_PUBLIC_API_URL;
  const url = configured?.trim().replace(/\/+$/, '');

  return url ? url : null;
}
