import { useFocusEffect, useRouter } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ProgressoDoLivro } from '@/components/progresso-do-livro';
import { Accent, DSFonts, Ink, Mint, Radius, Space, TextColor } from '@/constants/design-system';
import { listarMinhasAvaliacoes } from '@/services/avaliacoes';
import {
  listarBiblioteca,
  resumoDeLeitura,
  type BibliotecaItem,
  type ResumoDeLeitura,
} from '@/services/biblioteca';

type Dados = { resumo: ResumoDeLeitura; avaliacoes: number; lendo: BibliotecaItem[] };

type Numero = {
  rotulo: string;
  valor: number;
  cor: string;
  icone: SymbolViewProps['name'];
};

const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

/** Tracker de leitura do perfil: totais e os livros em "Lendo" com a barra de progresso. */
export function ResumoLeitura() {
  const router = useRouter();
  const [dados, setDados] = useState<Dados | null>(null);

  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      Promise.all([listarBiblioteca(controller.signal), listarMinhasAvaliacoes(controller.signal)])
        .then(([itens, avaliacoes]) =>
          setDados({
            resumo: resumoDeLeitura(itens),
            avaliacoes: avaliacoes.length,
            lendo: itens.filter((item) => item.statusLeitura === 'LENDO'),
          }),
        )
        .catch(() => {
          // Sem os números, o perfil continua com os dados da conta.
        });
      return () => controller.abort();
    }, []),
  );

  if (!dados) return null;
  const { resumo, avaliacoes, lendo } = dados;
  const numeros: Numero[] = [
    {
      rotulo: plural(resumo.paginasLidas, 'Página lida', 'Páginas lidas'),
      valor: resumo.paginasLidas,
      cor: Mint.mint400,
      icone: { ios: 'book.pages.fill', android: 'auto_stories', web: 'auto_stories' },
    },
    {
      rotulo: plural(resumo.diasLeitura, 'Dia de leitura', 'Dias de leitura'),
      valor: resumo.diasLeitura,
      cor: Accent.amber,
      icone: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' },
    },
    {
      rotulo: plural(resumo.lidos, 'Livro lido', 'Livros lidos'),
      valor: resumo.lidos,
      cor: Accent.laurel,
      icone: { ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' },
    },
    {
      rotulo: plural(avaliacoes, 'Avaliação', 'Avaliações'),
      valor: avaliacoes,
      cor: Accent.lilac,
      icone: { ios: 'star.fill', android: 'star', web: 'star' },
    },
  ];

  return (
    <View style={styles.raiz}>
      <Text accessibilityRole="header" style={styles.titulo}>
        Tracker de leitura
      </Text>
      <View style={styles.grade}>
        {numeros.map((n) => (
          <View
            key={n.rotulo}
            style={styles.item}
            accessible
            accessibilityLabel={`${n.valor.toLocaleString('pt-BR')} ${n.rotulo.toLowerCase()}`}>
            <SymbolView name={n.icone} size={18} tintColor={n.cor} />
            <Text style={[styles.valor, { color: n.cor }]}>{n.valor.toLocaleString('pt-BR')}</Text>
            <Text style={styles.rotulo}>{n.rotulo}</Text>
          </View>
        ))}
      </View>

      {lendo.length > 0 ? (
        <View style={styles.lendo}>
          <Text style={styles.subtitulo}>Lendo agora</Text>
          {lendo.map((item) => (
            <Pressable
              key={item.id}
              onPress={() =>
                router.push({ pathname: '/livro/[id]', params: { id: item.livro.id } })
              }
              accessibilityRole="button"
              accessibilityLabel={`Abrir ${item.livro.titulo}`}
              style={({ pressed }) => [styles.livro, pressed && styles.pressionado]}>
              <Text style={styles.livroTitulo} numberOfLines={1}>
                {item.livro.titulo}
              </Text>
              <ProgressoDoLivro progresso={item.progresso} compacto />
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={styles.vazio}>
          Marque um livro como &quot;Lendo&quot; para acompanhar páginas e dias de leitura aqui.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: {
    alignSelf: 'stretch',
    padding: Space.four,
    borderRadius: Radius.card,
    backgroundColor: Ink.ink700,
    borderWidth: 1,
    borderColor: Ink.ink500,
    gap: Space.four,
  },
  titulo: { fontFamily: DSFonts.display, fontSize: 20, lineHeight: 26, color: TextColor.primary },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.two },
  item: {
    flexGrow: 1,
    flexBasis: '45%',
    gap: Space.one,
    padding: Space.three,
    borderRadius: Radius.card,
    backgroundColor: Ink.ink800,
  },
  valor: { fontFamily: DSFonts.display, fontSize: 24, lineHeight: 30 },
  rotulo: {
    fontFamily: DSFonts.ui,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: TextColor.secondary,
  },
  lendo: { gap: Space.two },
  subtitulo: {
    fontFamily: DSFonts.ui,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: TextColor.secondary,
  },
  livro: { paddingVertical: Space.two, borderTopWidth: 1, borderTopColor: Ink.ink600 },
  pressionado: { opacity: 0.7 },
  livroTitulo: {
    fontFamily: DSFonts.ui,
    fontSize: 15,
    fontWeight: '700',
    color: TextColor.primary,
  },
  vazio: { fontFamily: DSFonts.ui, fontSize: 13, lineHeight: 19, color: TextColor.secondary },
});
