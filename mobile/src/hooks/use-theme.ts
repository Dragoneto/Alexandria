/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useTheme() {
  const scheme = useColorScheme();

  // `useColorScheme()` pode devolver null no nativo, apesar do .d.ts do React Native
  // declarar o contrário. Normalizamos em vez de indexar `Colors` com valor inválido.
  return Colors[scheme === 'dark' ? 'dark' : 'light'];
}
