import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  DSFonts,
  Ink,
  Mint,
  Radius,
  ScreenInset,
  Shadow,
  Space,
  TextColor,
} from '@/constants/design-system';

const ALTURA_BARRA = 64;
const TAMANHO_ICONE = 24;

// Cores do nome da aba (as mesmas do ícone, definidas no _layout.tsx)
const COR_ATIVA = Mint.mint400;
const COR_INATIVA = TextColor.muted;

export function NavBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  return (
    // Fundo da área da barra (mesma cor das telas) + espaço do "risquinho" do celular
    <View style={[styles.fundo, { paddingBottom: Math.max(insets.bottom, Space.three) }]}>
      <View style={styles.barra}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focado = state.index === index;

          function aoTocar() {
            // Avisa o Expo Router do toque (mantém funcionando os eventos "tabPress")
            const evento = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!focado && !evento.defaultPrevented) {
              Haptics.selectionAsync(); // vibração curtinha, só quando troca de aba
              navigation.navigate(route.name, route.params);
            }
          }

          function aoSegurar() {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          }

          return (
            <BotaoAba
              key={route.key}
              titulo={options.title ?? route.name}
              focado={focado}
              onPress={aoTocar}
              onLongPress={aoSegurar}
              icone={options.tabBarIcon?.({
                focused: focado,
                color: focado ? COR_ATIVA : COR_INATIVA,
                size: TAMANHO_ICONE,
              })}
            />
          );
        })}
      </View>
    </View>
  );
}

type BotaoAbaProps = {
  titulo: string;
  focado: boolean;
  icone: ReactNode;
  onPress: () => void;
  onLongPress: () => void;
};

function BotaoAba({ titulo, focado, icone, onPress, onLongPress }: BotaoAbaProps) {
  // Cor do nome: 0 = cinza, 1 = verde
  const ativo = useSharedValue(focado ? 1 : 0);

  useEffect(() => {
    ativo.value = withTiming(focado ? 1 : 0, { duration: 250 });
  }, [focado, ativo]);

  const nomeStyle = useAnimatedStyle(() => ({
    color: interpolateColor(ativo.value, [0, 1], [COR_INATIVA, COR_ATIVA]),
  }));

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: focado }}
      accessibilityLabel={titulo}
      style={styles.aba}>
      <View style={styles.conteudoAba}>
        {icone}
        <Animated.Text numberOfLines={1} style={[styles.nome, nomeStyle]}>
          {titulo}
        </Animated.Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fundo: {
    backgroundColor: Ink.ink900,
    paddingHorizontal: ScreenInset,
    paddingTop: Space.two,
  },
  barra: {
    flexDirection: 'row',
    height: ALTURA_BARRA,
    borderRadius: Radius.sheet,
    backgroundColor: Ink.ink700,
    borderWidth: 1,
    borderColor: Ink.ink500,
    ...Shadow.e2,
  },
  aba: {
    flex: 1, // todas as abas com a mesma largura
    alignItems: 'center',
    justifyContent: 'center',
  },
  conteudoAba: {
    alignItems: 'center',
    gap: Space.one, // espaço entre o ícone e o nome
  },
  nome: {
    fontFamily: DSFonts.ui,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
