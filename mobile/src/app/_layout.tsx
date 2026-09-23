import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { ActivityIndicator, Text, View, useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { ActionButton } from '@/components/action-button';
import { AppErrorBoundary } from '@/components/app-error-boundary';
import { Ink, Mint, Space, TextColor } from '@/constants/design-system';
import { AuthProvider, useAuth } from '@/contexts/auth-context';

SplashScreen.preventAutoHideAsync().catch(() => {});
export const ErrorBoundary = AppErrorBoundary;

function SessionRoutes() {
  const { user, loading, error, retry, dismissSession } = useAuth();
  if (loading || error) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          padding: Space.six,
          gap: Space.four,
          backgroundColor: Ink.ink900,
        }}>
        {loading ? (
          <ActivityIndicator accessibilityLabel="Verificando sessão" color={Mint.mint400} />
        ) : (
          <>
            <Text accessibilityRole="alert" style={{ color: TextColor.primary }}>
              {error}
            </Text>
            <ActionButton label="Tentar novamente" onPress={retry} />
            <ActionButton label="Voltar para entrar" variant="ghost" onPress={dismissSession} />
          </>
        )}
      </View>
    );
  }
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="cadastro" />
        <Stack.Screen name="esqueci-senha" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AuthProvider>
        <SessionRoutes />
      </AuthProvider>
    </ThemeProvider>
  );
}
