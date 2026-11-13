import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import Head from 'expo-router/head';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AppErrorBoundary } from '@/components/app-error-boundary';
import { AvisoServidorAcordando } from '@/components/aviso-servidor-acordando';
import { ErrorState } from '@/components/error-state';
import { SkeletonSessionShell } from '@/components/skeletons';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { useLoadingGate } from '@/hooks/use-loading-gate';

SplashScreen.preventAutoHideAsync().catch(() => {});
export const ErrorBoundary = AppErrorBoundary;

function SessionRoutes() {
  const { user, loading, error, retry, dismissSession } = useAuth();
  const showLoading = useLoadingGate(loading);
  if (loading) {
    if (!showLoading) return null;
    return (
      <View style={{ flex: 1 }}>
        <SkeletonSessionShell />
        <View style={{ position: 'absolute', left: 24, right: 24, bottom: 120 }}>
          <AvisoServidorAcordando carregando={loading} />
        </View>
      </View>
    );
  }
  if (error)
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <ErrorState
          title="Não foi possível verificar sua sessão"
          message={error}
          onRetry={retry}
          secondaryAction={{ label: 'Voltar para entrar', onPress: dismissSession }}
        />
      </View>
    );
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="editar_perfil" />
        <Stack.Screen name="alterar-senha" />
        <Stack.Screen name="configuracoes" />
        <Stack.Screen name="sobre" />
        <Stack.Screen name="equipe" />
        <Stack.Screen name="curiosidades" />
        <Stack.Screen name="ajuda" />
        <Stack.Screen name="livro/[id]" />
        <Stack.Screen name="avaliar/[id]" />
        <Stack.Screen name="comentario/[id]" />
        <Stack.Screen name="notificacoes" />
        <Stack.Screen name="minhas-avaliacoes" />
        <Stack.Screen name="avaliacao/[id]" />
      </Stack.Protected>
      <Stack.Protected guard={!user} redirectTo="/home">
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="cadastro" />
        <Stack.Screen name="esqueci-senha" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  // Na web o HTML gerado vem com lang="en"; o app é todo em português.
  useEffect(() => {
    if (Platform.OS === 'web') document.documentElement.lang = 'pt-BR';
  }, []);

  return (
    <ThemeProvider value={DarkTheme}>
      <Head>
        <title>Alexandria</title>
        <meta
          name="description"
          content="Sua biblioteca virtual e comunidade literária: organize leituras, avalie livros e converse com outros leitores."
        />
      </Head>
      <AnimatedSplashOverlay />
      <AuthProvider>
        <SessionRoutes />
      </AuthProvider>
    </ThemeProvider>
  );
}
