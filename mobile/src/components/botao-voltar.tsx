import { type Href, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { Ink, Mint, Radius } from '@/constants/design-system';

type BotaoVoltarProps = {
  /** Para onde ir quando a tela foi aberta direto pelo link e não há tela anterior. */
  fallback?: Href;
  style?: StyleProp<ViewStyle>;
};

export function BotaoVoltar({ fallback = '/perfil', style }: BotaoVoltarProps) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Voltar"
      style={({ pressed }) => [styles.voltar, pressed && styles.pressionado, style]}>
      <SymbolView
        name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
        size={20}
        tintColor={Mint.mint400}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  voltar: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    backgroundColor: Ink.ink700,
    borderWidth: 1,
    borderColor: Ink.ink500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressionado: { backgroundColor: Ink.ink600 },
});
