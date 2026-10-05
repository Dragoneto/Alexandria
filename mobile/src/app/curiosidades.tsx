import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Accent,
  DSFonts,
  Ink,
  Mint,
  Radius,
  ScreenInset,
  Space,
  TextColor,
  withAlpha,
} from '@/constants/design-system';

// Lista de curiosidades. Para adicionar uma nova, é só copiar um bloco { ... }.
const CURIOSIDADES = [
  {
    categoria: 'História',
    texto:
      'A Biblioteca de Alexandria, no Egito, foi fundada há mais de 2.200 anos e pode ter guardado centenas de milhares de rolos de papiro. Ela inspirou o nome deste app!',
    cor: Accent.amber,
    icone: { ios: 'building.columns.fill', android: 'account_balance', web: 'account_balance' },
  },
  {
    categoria: 'Invenções',
    texto:
      'Por volta de 1450, Johannes Gutenberg criou a prensa de tipos móveis. Antes disso, os livros eram copiados à mão, um por um.',
    cor: Accent.sapphire,
    icone: { ios: 'printer.fill', android: 'print', web: 'print' },
  },
  {
    categoria: 'Literatura',
    texto:
      'Dom Quixote, de Miguel de Cervantes, publicado em 1605, é considerado por muitos o primeiro romance moderno.',
    cor: Accent.lilac,
    icone: { ios: 'book.closed.fill', android: 'menu_book', web: 'menu_book' },
  },
  {
    categoria: 'Brasil',
    texto:
      'Machado de Assis foi um dos fundadores da Academia Brasileira de Letras, em 1897, e o seu primeiro presidente.',
    cor: Accent.laurel,
    icone: { ios: 'graduationcap.fill', android: 'school', web: 'school' },
  },
  {
    categoria: 'Palavras',
    texto:
      '"Tsundoku" é uma palavra japonesa para o hábito de comprar livros e deixá-los empilhados sem ler. Conhece alguém assim?',
    cor: Accent.coral,
    icone: { ios: 'square.stack.3d.up.fill', android: 'layers', web: 'layers' },
  },
  {
    categoria: 'Ciência',
    texto:
      'O cheiro de livro antigo vem do papel se desgastando com o tempo. Esse processo libera substâncias como a vanilina, que lembra baunilha.',
    cor: Mint.mint400,
    icone: { ios: 'wind', android: 'air', web: 'air' },
  },
  {
    categoria: 'Recordes',
    texto:
      'A Biblioteca do Congresso, nos Estados Unidos, é a maior do mundo, com mais de 170 milhões de itens no acervo.',
    cor: Accent.amber,
    icone: { ios: 'archivebox.fill', android: 'inventory_2', web: 'inventory_2' },
  },
  {
    categoria: 'Tecnologia',
    texto:
      'Os dados dos livros do Alexandria vêm da Open Library, um projeto que quer ter uma página para cada livro já publicado.',
    cor: Accent.sapphire,
    icone: { ios: 'globe', android: 'public', web: 'public' },
  },
] as const;

export default function CuriosidadesScreen() {
  const router = useRouter();

  // Guarda qual curiosidade aparece no destaque (começa na primeira, posição 0)
  const [indice, setIndice] = useState(0);
  const destaque = CURIOSIDADES[indice];

  // Vai para a próxima curiosidade. Quando chega na última, volta para a primeira.
  function proximaCuriosidade() {
    setIndice((atual) => (atual + 1) % CURIOSIDADES.length);
  }

  return (
    <SafeAreaView style={styles.tela}>
      <ScrollView contentContainerStyle={styles.conteudo}>
        {/* Botão de voltar (o mesmo das outras telas) */}
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          style={({ pressed }) => [styles.voltar, pressed && styles.voltarPressionado]}>
          <SymbolView
            name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
            size={20}
            tintColor={Mint.mint400}
          />
        </Pressable>

        {/* Cabeçalho */}
        <View style={styles.cabecalho}>
          <View style={styles.cabecalhoIcone}>
            <SymbolView
              name={{ ios: 'lightbulb.fill', android: 'lightbulb', web: 'lightbulb' }}
              size={36}
              tintColor={Accent.amber}
            />
          </View>
          <Text style={styles.titulo}>Você sabia?</Text>
          <Text style={styles.subtitulo}>Curiosidades sobre livros, leitura e bibliotecas.</Text>
        </View>

        {/* Cartão de destaque */}
        <Text style={styles.secaoTitulo}>Curiosidade em destaque</Text>
        <View style={[styles.destaque, { borderColor: withAlpha(destaque.cor, 0.5) }]}>
          <View style={[styles.selo, { backgroundColor: withAlpha(destaque.cor, 0.15) }]}>
            <SymbolView name={destaque.icone} size={14} tintColor={destaque.cor} />
            <Text style={[styles.seloTexto, { color: destaque.cor }]}>{destaque.categoria}</Text>
          </View>

          <Text style={styles.destaqueTexto}>{destaque.texto}</Text>

          <View style={styles.destaqueRodape}>
            <Text style={styles.contador}>
              {indice + 1} de {CURIOSIDADES.length}
            </Text>
            <Pressable
              onPress={proximaCuriosidade}
              accessibilityRole="button"
              style={({ pressed }) => [styles.botao, pressed && styles.botaoPressionado]}>
              <Text style={styles.botaoTexto}>Outra curiosidade</Text>
              <SymbolView
                name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }}
                size={16}
                tintColor={Ink.ink900}
              />
            </Pressable>
          </View>
        </View>

        {/* Lista com todas as curiosidades */}
        <Text style={styles.secaoTitulo}>Todas as curiosidades</Text>
        {CURIOSIDADES.map((item, index) => (
          <Pressable
            key={index}
            onPress={() => setIndice(index)}
            style={({ pressed }) => [
              styles.cartao,
              index === indice && { borderColor: item.cor },
              pressed && styles.cartaoPressionado,
            ]}>
            <View style={[styles.iconeFundo, { backgroundColor: withAlpha(item.cor, 0.15) }]}>
              <SymbolView name={item.icone} size={20} tintColor={item.cor} />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.categoria, { color: item.cor }]}>{item.categoria}</Text>
              <Text style={styles.cartaoTexto}>{item.texto}</Text>
            </View>
          </Pressable>
        ))}

        <Text style={styles.rodape}>Toque em uma curiosidade para colocá-la em destaque</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: Ink.ink900 },
  conteudo: { padding: ScreenInset, paddingBottom: Space.twelve },
  flex: { flex: 1 },

  // Botão de voltar
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
  voltarPressionado: { backgroundColor: Ink.ink600 },

  // Cabeçalho
  cabecalho: { alignItems: 'center', marginTop: Space.four },
  cabecalhoIcone: {
    width: 80,
    height: 80,
    borderRadius: Radius.pill,
    backgroundColor: withAlpha(Accent.amber, 0.15),
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: {
    marginTop: Space.four,
    fontFamily: DSFonts.display,
    fontSize: 28,
    color: TextColor.primary,
  },
  subtitulo: {
    marginTop: Space.two,
    fontFamily: DSFonts.ui,
    fontSize: 15,
    color: TextColor.secondary,
    textAlign: 'center',
  },

  // Títulos das seções
  secaoTitulo: {
    marginTop: Space.eight,
    marginBottom: Space.two,
    fontFamily: DSFonts.ui,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: TextColor.secondary,
  },

  // Cartão de destaque
  destaque: {
    padding: Space.six,
    backgroundColor: Ink.ink700,
    borderRadius: Radius.sheet,
    borderWidth: 1,
  },
  selo: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Space.one,
    paddingHorizontal: Space.three,
    paddingVertical: Space.one,
    borderRadius: Radius.pill,
  },
  seloTexto: { fontFamily: DSFonts.ui, fontSize: 12, fontWeight: '700' },
  destaqueTexto: {
    marginTop: Space.four,
    fontFamily: DSFonts.display,
    fontSize: 20,
    lineHeight: 30,
    color: TextColor.primary,
  },
  destaqueRodape: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Space.six,
  },
  contador: { fontFamily: DSFonts.ui, fontSize: 13, color: TextColor.muted },
  botao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.two,
    paddingHorizontal: Space.four,
    paddingVertical: Space.three,
    borderRadius: Radius.pill,
    backgroundColor: Mint.mint400,
  },
  botaoPressionado: { backgroundColor: Mint.mint500 },
  botaoTexto: { fontFamily: DSFonts.ui, fontSize: 14, fontWeight: '700', color: Ink.ink900 },

  // Cartões da lista
  cartao: {
    flexDirection: 'row',
    gap: Space.three,
    marginBottom: Space.three,
    padding: Space.four,
    backgroundColor: Ink.ink700,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Ink.ink500,
  },
  cartaoPressionado: { backgroundColor: Ink.ink600 },
  iconeFundo: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoria: {
    fontFamily: DSFonts.ui,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  cartaoTexto: {
    marginTop: Space.one,
    fontFamily: DSFonts.ui,
    fontSize: 14,
    lineHeight: 21,
    color: TextColor.secondary,
  },

  rodape: {
    marginTop: Space.six,
    textAlign: 'center',
    fontFamily: DSFonts.ui,
    fontSize: 13,
    color: TextColor.muted,
  },
});
