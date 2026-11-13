import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useEffect, useRef } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ActionButton } from '@/components/action-button';
import {
  DSFonts,
  Ink,
  Radius,
  ScreenInset,
  Shadow,
  Space,
  TextColor,
  withAlpha,
} from '@/constants/design-system';

export type Destaque = {
  icon: SymbolViewProps['name'];
  tint: string;
  title: string;
  description: string;
  /** Frase de abertura do popup. */
  resumo: string;
  /** O que dá para fazer, um item por linha. */
  pontos: readonly string[];
};

type PopupDestaqueProps = {
  destaque: Destaque | null;
  /** Chamado depois que a animação de saída termina. */
  onFechado: () => void;
  onComecar: () => void;
};

const ENTRADA = 280;
const SAIDA = 200;

/** Explica um dos destaques da tela de boas-vindas, com entrada e saída suaves. */
export function PopupDestaque({ destaque, onFechado, onComecar }: PopupDestaqueProps) {
  const reduzirMovimento = useReducedMotion();
  const progresso = useSharedValue(0);
  const fechando = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!destaque) return;
    fechando.current = false;
    progresso.set(0);
    progresso.set(
      reduzirMovimento ? 1 : withTiming(1, { duration: ENTRADA, easing: Easing.out(Easing.cubic) }),
    );
  }, [destaque, progresso, reduzirMovimento]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const fechar = (depois?: () => void) => {
    if (fechando.current) return;
    fechando.current = true;
    const duracao = reduzirMovimento ? 0 : SAIDA;
    progresso.set(withTiming(0, { duration: duracao, easing: Easing.in(Easing.cubic) }));
    timer.current = setTimeout(() => {
      onFechado();
      depois?.();
    }, duracao);
  };

  const fundo = useAnimatedStyle(() => ({ opacity: progresso.value }));
  const cartao = useAnimatedStyle(() => ({
    opacity: progresso.value,
    transform: [
      { translateY: (1 - progresso.value) * 28 },
      { scale: 0.96 + progresso.value * 0.04 },
    ],
  }));

  return (
    <Modal
      visible={!!destaque}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => fechar()}>
      <View style={styles.raiz}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.veu, fundo]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => fechar()}
            accessibilityLabel="Fechar explicação"
          />
        </Animated.View>

        {destaque && (
          <Animated.View style={[styles.cartao, cartao]} accessibilityViewIsModal>
            {/* Rola por dentro quando a tela é baixa (celular deitado). */}
            <ScrollView contentContainerStyle={styles.conteudo} bounces={false}>
              <View
                style={[
                  styles.selo,
                  {
                    backgroundColor: withAlpha(destaque.tint, 0.14),
                    borderColor: withAlpha(destaque.tint, 0.4),
                  },
                ]}>
                <SymbolView
                  name={destaque.icon}
                  size={34}
                  weight="semibold"
                  tintColor={destaque.tint}
                />
              </View>

              <Text accessibilityRole="header" style={styles.titulo}>
                {destaque.title}
              </Text>
              <Text style={styles.resumo}>{destaque.resumo}</Text>

              <View style={styles.pontos}>
                {destaque.pontos.map((ponto) => (
                  <View key={ponto} style={styles.ponto}>
                    <View style={[styles.marcador, { backgroundColor: destaque.tint }]} />
                    <Text style={styles.pontoTexto}>{ponto}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.acoes}>
                <ActionButton label="Criar minha conta" onPress={() => fechar(onComecar)} />
                <ActionButton label="Fechar" variant="ghost" onPress={() => fechar()} />
              </View>
            </ScrollView>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  raiz: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: ScreenInset,
  },
  veu: { backgroundColor: withAlpha(Ink.ink900, 0.82) },
  cartao: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
    backgroundColor: Ink.ink700,
    borderRadius: Radius.sheet,
    borderWidth: 1,
    borderColor: Ink.ink500,
    overflow: 'hidden',
    ...Shadow.e2,
  },
  conteudo: { padding: Space.six },
  selo: {
    width: 64,
    height: 64,
    borderRadius: Radius.sheet,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: {
    marginTop: Space.four,
    fontFamily: DSFonts.display,
    fontSize: 24,
    lineHeight: 30,
    color: TextColor.primary,
  },
  resumo: {
    marginTop: Space.two,
    fontFamily: DSFonts.ui,
    fontSize: 15,
    lineHeight: 22,
    color: TextColor.secondary,
  },
  pontos: { marginTop: Space.four, gap: Space.three },
  ponto: { flexDirection: 'row', gap: Space.three, alignItems: 'flex-start' },
  marcador: { width: 6, height: 6, borderRadius: Radius.pill, marginTop: 8 },
  pontoTexto: {
    flex: 1,
    fontFamily: DSFonts.ui,
    fontSize: 14,
    lineHeight: 21,
    color: TextColor.primary,
  },
  acoes: { marginTop: Space.six, gap: Space.three },
});
