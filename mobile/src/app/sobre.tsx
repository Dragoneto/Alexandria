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
  Shadow,
} from '@/constants/design-system';


const VERSAO = Constants.expoConfig?.version ?? '1.0.0';
const ANO = new Date().getFullYear();

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


const INFORMACOES = [
  {
    rotulo: 'Versão',
    valor: VERSAO,
    icone: { ios: 'number', android: 'tag', web: 'tag' },
  },
  {
    rotulo: 'Feito com',
    valor: 'React Native + Expo',
    icone: { ios: 'chevron.left.forwardslash.chevron.right', android: 'code', web: 'code' },
  },
  {
    rotulo: 'Dados dos livros',
    valor: 'Open Library',
    icone: { ios: 'book.fill', android: 'menu_book', web: 'menu_book' },
  },
] as const;

const ATALHOS = [
  {
    titulo: 'Conheça a equipe',
    descricao: 'Quem criou o Alexandria',
    rota: '/equipe',
    cor: Accent.lilac,
    icone: { ios: 'person.3.fill', android: 'groups', web: 'groups' },
  },
  {
    titulo: 'Ajuda e FAQ',
    descricao: 'Respostas para as dúvidas mais comuns',
    rota: '/ajuda',
    cor: Accent.sapphire,
    icone: { ios: 'questionmark.circle.fill', android: 'help', web: 'help' },
  },
] as const;


export default function SobreScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.tela} edges={['top']}>
      <ScrollView contentContainerStyle={styles.conteudo} showsVerticalScrollIndicator={false}>
        {/* Botão de voltar (o mesmo da tela de Ajuda) */}
        <Pressable
          onPress={() => router.back()}
          hitSlop={Space.two}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          style={({ pressed }) => [styles.voltar, pressed && styles.pressionado]}>
          <SymbolView
            name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
            size={20}
            tintColor={TextColor.primary}
          />
        </Pressable>

        {/* Cabeçalho no formato da Home: rótulo pequeno + título serifado */}
        <View style={styles.cabecalho}>
          <Text style={styles.rotulo}>Sobre o app</Text>
          <Text style={styles.titulo}>Sua biblioteca no bolso</Text>
        </View>

        {/* Cartão da marca: logo, nome e versão */}
        <View style={styles.marca}>
          <View style={styles.logoFundo}>
            <Image
              source={require('@/assets/images/logo_app.png')}
              style={styles.logo}
              contentFit="contain"
            />
          </View>
          <View style={styles.marcaTextos}>
            <Text style={styles.nomeApp}>Alexandria</Text>
            <View style={styles.selo}>
              <Text style={styles.seloTexto}>Versão {VERSAO}</Text>
            </View>
          </View>
        </View>

        {/* Nossa missão, em formato de citação */}
        <Text style={styles.secaoTitulo}>Nossa missão</Text>
        <View style={styles.citacao}>
          <SymbolView
            name={{ ios: 'quote.opening', android: 'format_quote', web: 'format_quote' }}
            size={22}
            tintColor={Mint.mint400}
          />
          <Text style={styles.citacaoTexto}>
            Inspirado na lendária Biblioteca de Alexandria, o app nasceu para ajudar você a
            descobrir novos livros, organizar suas leituras e compartilhar o que ama ler.
          </Text>
        </View>

               {/* Recursos: um cartão abaixo do outro */}
        <Text style={styles.secaoTitulo}>O que você encontra aqui</Text>
        <View style={styles.recursos}>
          {RECURSOS.map((recurso) => (
            <View key={recurso.titulo} style={styles.recurso}>
              <View style={[styles.iconeFundo, { backgroundColor: withAlpha(recurso.cor, 0.15) }]}>
                <SymbolView name={recurso.icone} size={22} tintColor={recurso.cor} />
              </View>
              <View style={styles.recursoTextos}>
                <Text style={styles.recursoTitulo}>{recurso.titulo}</Text>
                <Text style={styles.recursoDescricao}>{recurso.descricao}</Text>
              </View>
            </View>
          ))}
        </View>


        {/* Informações técnicas */}
        <Text style={styles.secaoTitulo}>Informações</Text>
        <View style={styles.cartao}>
          {INFORMACOES.map((info, index) => (
            <View key={info.rotulo} style={[styles.linha, index > 0 && styles.comBorda]}>
              <SymbolView name={info.icone} size={18} tintColor={TextColor.secondary} />
              <Text style={styles.linhaRotulo}>{info.rotulo}</Text>
              <Text style={styles.linhaValor}>{info.valor}</Text>
            </View>
          ))}
        </View>

        {/* Atalhos para outras telas */}
        <Text style={styles.secaoTitulo}>Saiba mais</Text>
        <View style={styles.cartao}>
          {ATALHOS.map((atalho, index) => (
            <Pressable
              key={atalho.rota}
              onPress={() => router.push(atalho.rota)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.linha,
                index > 0 && styles.comBorda,
                pressed && styles.pressionado,
              ]}>
              <View style={[styles.atalhoIcone, { backgroundColor: withAlpha(atalho.cor, 0.15) }]}>
                <SymbolView name={atalho.icone} size={18} tintColor={atalho.cor} />
              </View>
              <View style={styles.atalhoTextos}>
                <Text style={styles.atalhoTitulo}>{atalho.titulo}</Text>
                <Text style={styles.atalhoDescricao}>{atalho.descricao}</Text>
              </View>
              <SymbolView
                name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                size={18}
                tintColor={TextColor.secondary}
              />
            </Pressable>
          ))}
        </View>

        <Text style={styles.rodape}>Feito com carinho pela equipe Alexandria · {ANO}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: Ink.ink900 },
  conteudo: { paddingTop: Space.four, paddingBottom: Space.twelve },
  pressionado: { opacity: 0.7 },

  // Botão de voltar
  voltar: {
    width: 44,
    height: 44,
    marginLeft: ScreenInset,
    borderRadius: Radius.pill,
    backgroundColor: Ink.ink600,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Cabeçalho
  cabecalho: { marginTop: Space.six, paddingHorizontal: ScreenInset, gap: Space.one },
  rotulo: {
    fontFamily: DSFonts.ui,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.76,
    textTransform: 'uppercase',
    color: TextColor.secondary,
  },
  titulo: { fontFamily: DSFonts.display, fontSize: 28, lineHeight: 34, color: TextColor.primary },

  // Cartão da marca
  marca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.four,
    marginTop: Space.six,
    marginHorizontal: ScreenInset,
    padding: Space.four,
    borderRadius: Radius.sheet,
    backgroundColor: Ink.ink700,
    ...Shadow.e1,
  },
  logoFundo: {
    width: 72,
    height: 72,
    borderRadius: Radius.card,
    backgroundColor: Ink.ink600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: 52, height: 52 },
  marcaTextos: { flex: 1, alignItems: 'flex-start', gap: Space.two },
  nomeApp: { fontFamily: DSFonts.display, fontSize: 24, lineHeight: 30, color: TextColor.primary },
  selo: {
    paddingHorizontal: Space.three,
    paddingVertical: Space.one,
    borderRadius: Radius.pill,
    backgroundColor: Mint.mint900,
  },
  seloTexto: { fontFamily: DSFonts.ui, fontSize: 12, fontWeight: '700', color: Mint.mint400 },

  // Títulos de seção (iguais aos das estantes da Home)
  secaoTitulo: {
    marginTop: Space.eight,
    marginBottom: Space.three,
    paddingHorizontal: ScreenInset,
    fontFamily: DSFonts.display,
    fontSize: 20,
    lineHeight: 26,
    color: TextColor.primary,
  },

  // Citação da missão
  citacao: {
    gap: Space.three,
    marginHorizontal: ScreenInset,
    padding: Space.six,
    borderRadius: Radius.card,
    backgroundColor: Ink.ink700,
  },
  citacaoTexto: {
    fontFamily: DSFonts.display,
    fontSize: 17,
    lineHeight: 27,
    fontStyle: 'italic',
    color: TextColor.primary,
  },

  // Recursos (um cartão abaixo do outro)
  recursos: { marginHorizontal: ScreenInset, gap: Space.three },
  recurso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.four,
    padding: Space.four,
    borderRadius: Radius.card,
    backgroundColor: Ink.ink700,
  },
  iconeFundo: {
    width: 44,
    height: 44,
    borderRadius: Radius.cover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recursoTextos: { flex: 1, gap: Space.one },
  recursoTitulo: { fontFamily: DSFonts.ui, fontSize: 16, fontWeight: '600', color: TextColor.primary },
  recursoDescricao: {
    fontFamily: DSFonts.ui,
    fontSize: 14,
    lineHeight: 20,
    color: TextColor.secondary,
  },


  // Cartões com linhas (Informações e Saiba mais)
  cartao: {
    marginHorizontal: ScreenInset,
    paddingHorizontal: Space.four,
    borderRadius: Radius.card,
    backgroundColor: Ink.ink700,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.three,
    minHeight: 56,
    paddingVertical: Space.three,
  },
  comBorda: { borderTopWidth: 1, borderTopColor: Ink.ink500 },
  linhaRotulo: { flex: 1, fontFamily: DSFonts.ui, fontSize: 15, color: TextColor.secondary },
  linhaValor: { fontFamily: DSFonts.ui, fontSize: 15, fontWeight: '600', color: TextColor.primary },
  atalhoIcone: {
    width: 36,
    height: 36,
    borderRadius: Radius.cover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  atalhoTextos: { flex: 1, gap: 2 },
  atalhoTitulo: { fontFamily: DSFonts.ui, fontSize: 16, fontWeight: '600', color: TextColor.primary },
  atalhoDescricao: {
    fontFamily: DSFonts.ui,
    fontSize: 13,
    lineHeight: 18,
    color: TextColor.secondary,
  },

  rodape: {
    marginTop: Space.eight,
    textAlign: 'center',
    fontFamily: DSFonts.ui,
    fontSize: 13,
    color: TextColor.secondary,
  },
});