import { type Href, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { Ink, Mint, Radius } from '@/constants/design-system';
import { FeedbackPressable } from '@/components/feedback-pressable';

type BotaoVoltarProps = {
  /** Para onde ir quando a tela foi aberta direto pelo link e não há tela anterior. */
  fallback?: Href;
  style?: StyleProp<ViewStyle>;
};

export function BotaoVoltar({ fallback = '/perfil', style }: BotaoVoltarProps) {
  const router = useRouter();
  return (
    <FeedbackPressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Voltar"
      style={[styles.voltar, style]}>
      <SymbolView
        name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
        size={20}
        tintColor={Mint.mint400}
      />
    </FeedbackPressable>
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
