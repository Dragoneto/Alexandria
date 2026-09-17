import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  DSFonts,
  Ink,
  Mint,
  Radius,
  ScreenInset,
  Space,
  TextColor,
  TouchMin,
} from '@/constants/design-system';

type AuthShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

/** Moldura comum às telas de entrar e criar conta. */
export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  const router = useRouter();

  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={styles.halo} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={styles.flex}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {router.canGoBack() && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Voltar"
                onPress={() => router.back()}
                style={({ pressed }) => [styles.backButton, pressed && styles.backPressed]}>
                <SymbolView
                  name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
                  size={20}
                  tintColor={TextColor.primary}
                />
              </Pressable>
            )}

            <View style={styles.header}>
              <Image
                source={require('@/assets/images/logo_app.png')}
                style={styles.logo}
                contentFit="contain"
                accessibilityLabel="Logo do Alexandria"
              />
              <Text style={styles.wordmark}>ALEXANDRIA</Text>
            </View>

            {/* Título de tela · serifa 28/32 */}
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>

            {children}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Ink.ink900,
  },
  flex: {
    flex: 1,
  },
  halo: {
    position: 'absolute',
    top: -180,
    alignSelf: 'center',
    width: 360,
    height: 360,
    borderRadius: Radius.pill,
    backgroundColor: Mint.mint400,
    opacity: 0.07,
  },
  content: {
    paddingHorizontal: ScreenInset,
    paddingTop: Space.four,
    paddingBottom: Space.twelve,
  },
  backButton: {
    width: TouchMin,
    height: TouchMin,
    borderRadius: Radius.pill,
    backgroundColor: Ink.ink700,
    borderWidth: 1,
    borderColor: Ink.ink500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPressed: {
    backgroundColor: Ink.ink600,
  },
  header: {
    alignItems: 'center',
    gap: Space.two,
    marginTop: Space.six,
  },
  logo: {
    width: 56,
    height: 72,
  },
  wordmark: {
    fontFamily: DSFonts.ui,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3.5,
    color: TextColor.primary,
  },
  title: {
    marginTop: Space.eight,
    fontFamily: DSFonts.display,
    fontSize: 28,
    lineHeight: 32,
    color: TextColor.primary,
  },
  // Corpo · sans 15/24 · 400
  subtitle: {
    marginTop: Space.two,
    fontFamily: DSFonts.ui,
    fontSize: 15,
    lineHeight: 24,
    color: TextColor.secondary,
  },
});
