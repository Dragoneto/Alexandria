import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
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

const RECURSOS = [
  {
    titulo: 'Sua estante',
    descricao: 'Organize o que já leu, o que está lendo e o que ficou para depois.',
    cor: Accent.laurel,
    icone: { ios: 'books.vertical.fill', android: 'library_books', web: 'library_books' },
  },
  {
    titulo: 'Descobertas',
    descricao: 'Encontre lançamentos e clássicos por gênero, autor ou título.',
    cor: Accent.sapphire,
    icone: { ios: 'sparkle.magnifyingglass', android: 'travel_explore', web: 'travel_explore' },
  },
  {
    titulo: 'Comunidade',
    descricao: 'Veja resenhas, listas e o que outros leitores andam lendo.',
    cor: Accent.lilac,
    icone: { ios: 'person.2.fill', android: 'groups', web: 'groups' },
  },
] as const;

const VERSAO = Constants.expoConfig?.version ?? '1.0.0';

const INFORMACOES = [
  { rotulo: 'Versão', valor: VERSAO },
  { rotulo: 'Feito com', valor: 'React Native + Expo' },
  { rotulo: 'Dados dos livros', valor: 'Open Library' },
];


export default function SobreScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.tela}>
      <ScrollView contentContainerStyle={styles.conteudo}>
        {/* Botão de voltar (o mesmo da tela de Configurações) */}
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

        {/* Cabeçalho com logo, nome e versão */}
        <View style={styles.cabecalho}>
          <View style={styles.logoFundo}>
            <Image
              source={require('@/assets/images/logo_app.png')}
              style={styles.logo}
              contentFit="contain"
            />
          </View>
          <Text style={styles.nomeApp}>Alexandria</Text>
          <Text style={styles.slogan}>Sua biblioteca no bolso</Text>
          <View style={styles.selo}>
            <Text style={styles.seloTexto}>Versão {VERSAO}</Text>
          </View>
        </View>

        {/* Cartão: Nossa missão */}
        <Text style={styles.secaoTitulo}>Nossa missão</Text>
        <View style={styles.cartao}>
          <Text style={styles.paragrafo}>
            Inspirado na lendária Biblioteca de Alexandria, o app nasceu para ajudar você a
            descobrir novos livros, organizar suas leituras e compartilhar o que ama ler.
          </Text>
        </View>

        {/* Cartão: O que você encontra aqui */}
        <Text style={styles.secaoTitulo}>O que você encontra aqui</Text>
        <View style={styles.cartao}>
          {RECURSOS.map((recurso, index) => (
            <View
              key={recurso.titulo}
              style={[styles.recurso, index > 0 && styles.comBorda]}>
              <View style={[styles.iconeFundo, { backgroundColor: withAlpha(recurso.cor, 0.15) }]}>
                <SymbolView name={recurso.icone} size={20} tintColor={recurso.cor} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.recursoTitulo}>{recurso.titulo}</Text>
                <Text style={styles.recursoDescricao}>{recurso.descricao}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Cartão: Informações */}
        <Text style={styles.secaoTitulo}>Informações</Text>
        <View style={styles.cartao}>
          {INFORMACOES.map((info, index) => (
            <View key={info.rotulo} style={[styles.infoLinha, index > 0 && styles.comBorda]}>
              <Text style={styles.infoRotulo}>{info.rotulo}</Text>
              <Text style={styles.infoValor}>{info.valor}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.rodape}>Feito com carinho pela equipe Alexandria</Text>
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
  logoFundo: {
    width: 96,
    height: 96,
    borderRadius: Radius.sheet,
    backgroundColor: Ink.ink700,
    borderWidth: 1,
    borderColor: Ink.ink500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: 64, height: 64 },
  nomeApp: {
    marginTop: Space.four,
    fontFamily: DSFonts.display,
    fontSize: 30,
    color: TextColor.primary,
  },
  slogan: {
    marginTop: Space.one,
    fontFamily: DSFonts.ui,
    fontSize: 15,
    color: TextColor.secondary,
  },
  selo: {
    marginTop: Space.three,
    paddingHorizontal: Space.three,
    paddingVertical: Space.one,
    borderRadius: Radius.pill,
    backgroundColor: Mint.mint900,
  },
  seloTexto: { fontFamily: DSFonts.ui, fontSize: 12, fontWeight: '700', color: Mint.mint400 },

  // Seções e cartões
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
  cartao: {
    backgroundColor: Ink.ink700,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Ink.ink500,
    paddingHorizontal: Space.four,
  },
  comBorda: { borderTopWidth: 1, borderTopColor: Ink.ink500 },
  paragrafo: {
    paddingVertical: Space.four,
    fontFamily: DSFonts.ui,
    fontSize: 15,
    lineHeight: 24,
    color: TextColor.secondary,
  },

  // Linhas de recursos
  recurso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.three,
    paddingVertical: Space.four,
  },
  iconeFundo: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recursoTitulo: { fontFamily: DSFonts.ui, fontSize: 16, fontWeight: '600', color: TextColor.primary },
  recursoDescricao: {
    marginTop: 2,
    fontFamily: DSFonts.ui,
    fontSize: 13,
    lineHeight: 18,
    color: TextColor.secondary,
  },

  // Linhas de informação
  infoLinha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Space.four,
  },
  infoRotulo: { fontFamily: DSFonts.ui, fontSize: 15, color: TextColor.secondary },
  infoValor: { fontFamily: DSFonts.ui, fontSize: 15, fontWeight: '600', color: TextColor.primary },

  rodape: {
    marginTop: Space.eight,
    textAlign: 'center',
    fontFamily: DSFonts.ui,
    fontSize: 13,
    color: TextColor.muted,
  },
});
