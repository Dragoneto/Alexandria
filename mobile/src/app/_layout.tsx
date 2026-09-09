import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AppErrorBoundary } from '@/components/app-error-boundary';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Chamada dupla (fast refresh) rejeita — ignorar.
});

/** Usado pelo expo-router no lugar da tela genérica "Something went wrong". */
export const ErrorBoundary = AppErrorBoundary;

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
