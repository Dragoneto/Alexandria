import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/action-button';
import { CartaoDestaque, DESTAQUES } from '@/components/destaques';
import { PopupDestaque, type Destaque } from '@/components/popup-destaque';
import {
  DSFonts,
  Ink,
  Mint,
  Radius,
  ScreenInset,
  Shadow,
  Space,
  TextColor,
  withAlpha,
} from '@/constants/design-system';

/**
 * Atalho fixo para quem já tem conta. Fica no canto e só "acena" duas vezes
 * ao abrir a tela, para ser notado sem disputar com o botão principal.
 */
function AtalhoEntrar({ onPress }: { onPress: () => void }) {
  const reduzirMovimento = useReducedMotion();
  const aceno = useSharedValue(0);
  const [realcado, setRealcado] = useState(false);

  useEffect(() => {
    if (reduzirMovimento) return;
    aceno.set(
      withDelay(
        1400,
        withRepeat(
          withSequence(withTiming(1, { duration: 650 }), withTiming(0, { duration: 850 })),
          2,
        ),
      ),
    );
  }, [aceno, reduzirMovimento]);

  const anel = useAnimatedStyle(() => ({
    opacity: aceno.value * 0.7,
    transform: [{ scale: 1 + aceno.value * 0.12 }],
  }));
  const seta = useAnimatedStyle(() => ({ transform: [{ translateX: aceno.value * 3 }] }));

  return (
    <SafeAreaView edges={['top']} pointerEvents="box-none" style={styles.topo}>
      <View pointerEvents="box-none" style={styles.topoLinha}>
        <View>
          <Animated.View pointerEvents="none" style={[styles.entrarAnel, anel]} />
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Já tenho conta. Entrar"
            onPress={onPress}
            onHoverIn={() => setRealcado(true)}
            onHoverOut={() => setRealcado(false)}
            onFocus={() => setRealcado(true)}
            onBlur={() => setRealcado(false)}
            hitSlop={6}
            style={({ pressed }) => [
              styles.entrar,
              (realcado || pressed) && styles.entrarRealcado,
            ]}>
            <Text style={styles.entrarTexto}>Entrar</Text>
            <Animated.View style={seta}>
              <SymbolView
                name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }}
                size={16}
                tintColor={Mint.mint400}
              />
            </Animated.View>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

export default function WelcomeScreen() {
  const router = useRouter();
  const [aberto, setAberto] = useState<Destaque | null>(null);

  return (
    <View style={styles.root}>
      {/* Halo de marca — decorativo, atrás do conteúdo */}
      <View pointerEvents="none" style={styles.halo} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <SafeAreaView style={styles.safe}>
          {/* ── MARCA ── */}
          <View style={styles.brand}>
            <View style={styles.logoPlate}>
              <Image
                source={require('@/assets/images/logo_app.png')}
                style={styles.logo}
                contentFit="contain"
                accessibilityLabel="Logo do Alexandria"
              />
            </View>
            <Text style={styles.wordmark}>ALEXANDRIA</Text>
          </View>

          {/* ── DISPLAY ── */}
          <Text style={styles.display}>
            Descubra, organize{'\n'}e compartilhe{'\n'}suas leituras
          </Text>

          <Text style={styles.body}>
            O Alexandria é sua biblioteca virtual e comunidade literária. Guarde o que leu, planeje
            o que vem a seguir e acompanhe as descobertas de outros leitores.
          </Text>

          {/* ── DESTAQUES ── */}
          <View style={styles.highlights}>
            {DESTAQUES.map((item) => (
              <CartaoDestaque key={item.title} item={item} onPress={() => setAberto(item)} />
            ))}
          </View>

          {/* ── AÇÃO ── */}
          <View style={styles.actions}>
            <ActionButton label="Começar agora" onPress={() => router.push('/cadastro')} />
            <ActionButton
              label="Já tenho conta"
              variant="ghost"
              onPress={() => router.push('/login')}
            />
          </View>
        </SafeAreaView>
      </ScrollView>

      <AtalhoEntrar onPress={() => router.push('/login')} />

      <PopupDestaque
        destaque={aberto}
        onFechado={() => setAberto(null)}
        acao={() => ({ rotulo: 'Criar minha conta', onPress: () => router.push('/cadastro') })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Ink.ink900,
    // O halo é mais largo que telas de 320px; sem isso a página rola para o lado.
    overflow: 'hidden',
  },
  halo: {
    position: 'absolute',
    top: -140,
    alignSelf: 'center',
    width: 380,
    height: 380,
    borderRadius: Radius.pill,
    backgroundColor: Mint.mint400,
    opacity: 0.07,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  safe: {
    flex: 1,
    paddingHorizontal: ScreenInset,
    paddingBottom: Space.twelve,
    alignItems: 'center',
    // No computador os cartões e botões ficavam com a largura da tela inteira.
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },

  // Marca
  brand: {
    alignItems: 'center',
    marginTop: Space.twelve,
    gap: Space.four,
  },
  logoPlate: {
    width: 168,
    height: 168,
    borderRadius: Radius.pill,
    backgroundColor: Ink.ink700,
    borderWidth: 1,
    borderColor: Ink.ink500,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.e2,
  },
  logo: {
    width: 104,
    height: 132,
  },
  wordmark: {
    fontFamily: DSFonts.ui,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 4,
    color: TextColor.primary,
  },

  // Display · serifa 34/38
  display: {
    marginTop: Space.eight,
    fontFamily: DSFonts.display,
    fontSize: 34,
    lineHeight: 38,
    color: TextColor.primary,
    textAlign: 'center',
  },

  // Corpo · sans 15/24 · 400
  body: {
    marginTop: Space.four,
    fontFamily: DSFonts.ui,
    fontSize: 15,
    lineHeight: 24,
    fontWeight: '400',
    color: TextColor.secondary,
    textAlign: 'center',
    maxWidth: 320,
  },

  // Destaques
  highlights: {
    alignSelf: 'stretch',
    marginTop: Space.eight,
    gap: Space.three,
  },
  // Atalho "Entrar" no canto superior
  topo: { position: 'absolute', top: 0, left: 0, right: 0 },
  topoLinha: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: ScreenInset,
    paddingTop: Space.three,
  },
  entrar: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.two,
    paddingHorizontal: Space.four,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: withAlpha(Mint.mint400, 0.35),
    backgroundColor: withAlpha(Ink.ink800, 0.9),
  },
  entrarRealcado: {
    borderColor: withAlpha(Mint.mint400, 0.75),
    backgroundColor: withAlpha(Mint.mint400, 0.12),
  },
  entrarAnel: {
    ...StyleSheet.absoluteFill,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Mint.mint400,
  },
  entrarTexto: {
    fontFamily: DSFonts.ui,
    fontSize: 14,
    fontWeight: '700',
    color: Mint.mint400,
  },

  // Ação
  actions: {
    alignSelf: 'stretch',
    marginTop: Space.eight,
    gap: Space.three,
    alignItems: 'center',
  },
});
