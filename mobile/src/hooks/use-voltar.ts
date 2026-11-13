import { type Href, useRouter } from 'expo-router';
import { useCallback } from 'react';

/**
 * Volta uma tela. Sem histórico (link aberto direto ou página recarregada na web),
 * router.back() não faz nada, então vai para a tela de cima informada.
 */
export function useVoltar(fallback: Href) {
  const router = useRouter();
  return useCallback(
    () => (router.canGoBack() ? router.back() : router.replace(fallback)),
    [router, fallback],
  );
}
