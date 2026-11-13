import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/action-button';
import { PopupDestaque, type Destaque } from '@/components/popup-destaque';
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
  withAlpha,
} from '@/constants/design-system';

const HIGHLIGHTS: readonly Destaque[] = [
  {
    icon: { ios: 'books.vertical.fill', android: 'library_books', web: 'library_books' },
    tint: Accent.laurel,
    title: 'Sua estante',
    description: 'Organize o que já leu, o que está lendo e o que ficou para depois.',
    resumo: 'Sua biblioteca pessoal, organizada do seu jeito.',
    pontos: [
      'Separe os livros em Quero ler, Lendo, Lido e Abandonado.',
      'Marque os favoritos e encontre qualquer livro pela busca da estante.',
      'Mude o status quando quiser, direto na página do livro.',
    ],
  },
  {
    icon: { ios: 'person.2.fill', android: 'groups', web: 'groups' },
    tint: Accent.lilac,
    title: 'Comunidade',
    description: 'Avaliações, comentários e respostas de outros leitores.',
    resumo: 'Um lugar para conversar sobre o que você leu.',
    pontos: [
      'Dê sua nota e escreva o que achou de cada livro.',
      'Comente e responda as avaliações de outros leitores.',
      'Receba uma notificação quando alguém comentar ou responder você.',
    ],
  },
  {
    icon: { ios: 'sparkle.magnifyingglass', android: 'travel_explore', web: 'travel_explore' },
    tint: Accent.sapphire,
    title: 'Descobertas',
    description: 'Lançamentos e clássicos filtrados por gênero, autor ou título.',
    resumo: 'Sempre tem um próximo livro esperando.',
    pontos: [
      'Pesquise o acervo da Open Library por título, autor ou assunto.',
      'Explore categorias como Fantasia, Romance, História e Mistério.',
      'A home monta estantes novas a cada visita.',
    ],
  },
];

type CartaoDestaqueProps = { item: Destaque; onPress: () => void };

/** Cartão de destaque: abre a explicação ao tocar e reage ao passar o mouse na web. */
function CartaoDestaque({ item, onPress }: CartaoDestaqueProps) {
  const reduzirMovimento = useReducedMotion();
  const realce = useSharedValue(0);
  const animar = (valor: number) =>
    realce.set(reduzirMovimento ? valor : withTiming(valor, { duration: 160 }));

  const estilo = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(realce.value, [0, 1], [Ink.ink700, Ink.ink600]),
    borderColor: interpolateColor(realce.value, [0, 1], [Ink.ink500, withAlpha(item.tint, 0.55)]),
    transform: [{ translateY: realce.value * -2 }],
  }));
  const seta = useAnimatedStyle(() => ({
    opacity: 0.55 + realce.value * 0.45,
    transform: [{ translateX: realce.value * 3 }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.description}`}
      accessibilityHint="Abre uma explicação sobre este recurso"
      onPress={onPress}
      onHoverIn={() => animar(1)}
      onHoverOut={() => animar(0)}
      onFocus={() => animar(1)}
      onBlur={() => animar(0)}>
      {({ pressed }) => (
        <Animated.View style={[styles.card, estilo, pressed && styles.cardPressed]}>
          <View
            style={[
              styles.cardBadge,
              {
                backgroundColor: withAlpha(item.tint, 0.14),
                borderColor: withAlpha(item.tint, 0.4),
              },
            ]}>
            <SymbolView name={item.icon} size={30} weight="semibold" tintColor={item.tint} />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardDescription}>{item.description}</Text>
          </View>
          <Animated.View style={seta}>
            <SymbolView
              name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
              size={20}
              tintColor={item.tint}
            />
          </Animated.View>
        </Animated.View>
      )}
    </Pressable>
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
            {HIGHLIGHTS.map((item) => (
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

      <PopupDestaque
        destaque={aberto}
        onFechado={() => setAberto(null)}
        onComecar={() => router.push('/cadastro')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Ink.ink900,
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
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.four,
    padding: Space.four,
    borderRadius: Radius.card,
    backgroundColor: Ink.ink700,
    borderWidth: 1,
    borderColor: Ink.ink500,
    ...Shadow.e1,
  },
  // Selo do ícone — véu e borda derivados do próprio acento do cartão
  cardBadge: {
    width: 60,
    height: 60,
    borderRadius: Radius.sheet,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    flex: 1,
    gap: Space.one,
  },
  // Rótulo forte · sans 16/22 · 700
  cardTitle: {
    fontFamily: DSFonts.ui,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    color: TextColor.primary,
  },
  // Corpo pequeno · sans 13/20 · 500
  cardDescription: {
    fontFamily: DSFonts.ui,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
    color: TextColor.secondary,
  },

  cardPressed: { opacity: 0.8 },

  // Ação
  actions: {
    alignSelf: 'stretch',
    marginTop: Space.eight,
    gap: Space.three,
    alignItems: 'center',
  },
});
