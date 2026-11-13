import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { Accent, TextColor } from '@/constants/design-system';

type EstrelasProps = { nota: number; tamanho?: number };

/** Nota de 1 a 5 em ícones de estrela (no lugar dos caracteres ★ e ☆). */
export function Estrelas({ nota, tamanho = 16 }: EstrelasProps) {
  const cheias = Math.min(5, Math.max(0, Math.round(nota)));
  return (
    <View
      style={styles.linha}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Nota ${cheias} de 5`}>
      {[1, 2, 3, 4, 5].map((posicao) => (
        <SymbolView
          key={posicao}
          name={{ ios: 'star.fill', android: 'star', web: 'star' }}
          size={tamanho}
          // Na web e no Android os ícones são vazados: o traço mais grosso marca as estrelas da nota.
          weight={posicao <= cheias ? 'bold' : 'regular'}
          tintColor={posicao <= cheias ? Accent.amber : TextColor.muted}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
