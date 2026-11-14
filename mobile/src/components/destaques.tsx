import { SymbolView } from 'expo-symbols';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { Destaque } from '@/components/popup-destaque';
import {
  Accent,
  DSFonts,
  Ink,
  Radius,
  Shadow,
  Space,
  TextColor,
  withAlpha,
} from '@/constants/design-system';
import { FeedbackPressable } from '@/components/feedback-pressable';

/** Os três recursos do app: tela inicial e "Sobre o app" usam os mesmos cartões e textos. */
export const DESTAQUES: readonly Destaque[] = [
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
export function CartaoDestaque({ item, onPress }: CartaoDestaqueProps) {
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
    <FeedbackPressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.description}`}
      accessibilityHint="Abre uma explicação sobre este recurso"
      onPress={onPress}
      onHoverIn={() => animar(1)}
      onHoverOut={() => animar(0)}
      onFocus={() => animar(1)}
      onBlur={() => animar(0)}>
      <Animated.View style={[styles.card, estilo]}>
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
    </FeedbackPressable>
  );
}

const styles = StyleSheet.create({
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
});
