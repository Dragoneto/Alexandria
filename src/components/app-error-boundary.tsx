import type { ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Accent,
  DSFonts,
  Ink,
  Mint,
  Radius,
  ScreenInset,
  Shadow,
  Space,
  TextColor,
} from '@/constants/design-system';

/**
 * Tela de erro do app.
 *
 * Substitui o "Something went wrong" genérico do expo-router por algo legível: o
 * layout raiz chama `SplashScreen.preventAutoHideAsync()`, e o `hideAsync()` vive
 * dentro do overlay de splash — se o layout quebra, o overlay não renderiza e a
 * splash azul fica presa sobre a tela de erro. Aqui escondemos a splash sempre.
 */
export function AppErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {
      // A splash já pode ter sido escondida — não há o que fazer.
    });
  }, []);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.overline}>Algo quebrou</Text>
          <Text style={styles.title}>Não foi possível abrir esta tela</Text>

          <View style={styles.card}>
            <Text style={styles.errorName}>{error.name}</Text>
            <Text style={styles.errorMessage}>{error.message}</Text>
          </View>

          {!!error.stack && (
            <View style={styles.stackCard}>
              <Text style={styles.stackLabel}>Stack</Text>
              <Text style={styles.stack}>{error.stack}</Text>
            </View>
          )}
        </ScrollView>

        <Pressable
          accessibilityRole="button"
          onPress={retry}
          style={({ pressed }) => [styles.retryButton, pressed && styles.retryButtonPressed]}>
          <Text style={styles.retryLabel}>Tentar de novo</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Ink.ink900,
  },
  safe: {
    flex: 1,
    paddingHorizontal: ScreenInset,
    paddingBottom: Space.six,
  },
  content: {
    paddingTop: Space.eight,
    paddingBottom: Space.six,
    gap: Space.four,
  },
  overline: {
    fontFamily: DSFonts.ui,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.76,
    textTransform: 'uppercase',
    color: Accent.coral,
  },
  // Título de tela · serifa 28/32
  title: {
    fontFamily: DSFonts.display,
    fontSize: 28,
    lineHeight: 32,
    color: TextColor.primary,
  },
  card: {
    padding: Space.four,
    borderRadius: Radius.card,
    backgroundColor: Ink.ink700,
    borderWidth: 1,
    borderColor: Accent.coral,
    gap: Space.two,
    ...Shadow.e1,
  },
  errorName: {
    fontFamily: DSFonts.ui,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Accent.coral,
  },
  errorMessage: {
    fontFamily: DSFonts.ui,
    fontSize: 15,
    lineHeight: 24,
    color: TextColor.primary,
  },
  stackCard: {
    padding: Space.four,
    borderRadius: Radius.card,
    backgroundColor: Ink.ink800,
    borderWidth: 1,
    borderColor: Ink.ink500,
    gap: Space.two,
  },
  stackLabel: {
    fontFamily: DSFonts.ui,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.76,
    textTransform: 'uppercase',
    color: TextColor.secondary,
  },
  stack: {
    fontFamily: DSFonts.ui,
    fontSize: 12,
    lineHeight: 18,
    color: TextColor.secondary,
  },
  retryButton: {
    minHeight: 52,
    borderRadius: Radius.pill,
    backgroundColor: Mint.mint400,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.glow,
  },
  retryButtonPressed: {
    backgroundColor: Mint.mint500,
  },
  retryLabel: {
    fontFamily: DSFonts.ui,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    color: Ink.ink900,
  },
});
