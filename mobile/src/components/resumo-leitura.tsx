import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Accent, DSFonts, Ink, Mint, Radius, Space, TextColor } from '@/constants/design-system';
import { listarMinhasAvaliacoes } from '@/services/avaliacoes';
import { listarBiblioteca } from '@/services/biblioteca';

type Resumo = { lidos: number; lendo: number; avaliacoes: number };

/** Números de leitura no topo do perfil, como nas redes de leitura. */
export function ResumoLeitura() {
  const [resumo, setResumo] = useState<Resumo | null>(null);

  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      Promise.all([listarBiblioteca(controller.signal), listarMinhasAvaliacoes(controller.signal)])
        .then(([itens, avaliacoes]) =>
          setResumo({
            lidos: itens.filter((item) => item.statusLeitura === 'LIDO').length,
            lendo: itens.filter((item) => item.statusLeitura === 'LENDO').length,
            avaliacoes: avaliacoes.length,
          }),
        )
        .catch(() => {
          // Sem os números, o perfil continua com os dados da conta.
        });
      return () => controller.abort();
    }, []),
  );

  if (!resumo) return null;
  const numeros = [
    { rotulo: resumo.lidos === 1 ? 'Lido' : 'Lidos', valor: resumo.lidos, cor: Accent.laurel },
    { rotulo: 'Lendo', valor: resumo.lendo, cor: Mint.mint400 },
    {
      rotulo: resumo.avaliacoes === 1 ? 'Avaliação' : 'Avaliações',
      valor: resumo.avaliacoes,
      cor: Accent.amber,
    },
  ];

  return (
    <View style={styles.linha} accessibilityRole="summary">
      {numeros.map((n) => (
        <View
          key={n.rotulo}
          style={styles.item}
          accessible
          accessibilityLabel={`${n.valor} ${n.rotulo.toLowerCase()}`}>
          <Text style={[styles.valor, { color: n.cor }]}>{n.valor}</Text>
          <Text style={styles.rotulo}>{n.rotulo}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  linha: { flexDirection: 'row', gap: Space.two, alignSelf: 'stretch' },
  item: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Space.three,
    borderRadius: Radius.card,
    backgroundColor: Ink.ink700,
    borderWidth: 1,
    borderColor: Ink.ink500,
  },
  valor: { fontFamily: DSFonts.display, fontSize: 24, lineHeight: 30 },
  rotulo: {
    fontFamily: DSFonts.ui,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: TextColor.secondary,
  },
});
