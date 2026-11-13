import type { PropsWithChildren } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Spacing } from '@/constants/theme';

/** A partir desta largura a web está num computador ou tablet deitado. */
const LARGURA_LARGA = 768;

type Props = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}>;

/**
 * Web em tela larga: quem usa mouse comum não rola para o lado com a roda, então listas
 * horizontais precisam quebrar em linhas ou mostrar a barra de rolagem.
 */
export function useTelaLarga(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= LARGURA_LARGA;
}

/**
 * Fileira de chips. No celular rola para o lado com o dedo. Na web em tela larga quebra em
 * linhas: a roda do mouse comum só rola a página na vertical e a barra de rolagem fica
 * escondida, então os últimos chips ficavam fora de alcance.
 */
export function LinhaDeChips({
  children,
  style,
  contentContainerStyle,
  accessibilityLabel,
}: Props) {
  if (useTelaLarga()) {
    return (
      <View
        accessibilityLabel={accessibilityLabel}
        style={[style, contentContainerStyle, styles.quebrando]}>
        {children}
      </View>
    );
  }
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel={accessibilityLabel}
      style={style}
      contentContainerStyle={contentContainerStyle}>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  quebrando: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Spacing.two },
});
