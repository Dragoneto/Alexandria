import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { LayoutAnimation, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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

// Perguntas separadas por assunto. Cada assunto vira uma seção na tela.
const FAQ = [
  {
    assunto: 'Conta',
    cor: Accent.sapphire,
    icone: { ios: 'person.crop.circle.fill', android: 'account_circle', web: 'account_circle' },
    perguntas: [
      {
        pergunta: 'Como eu crio uma conta?',
        resposta:
          'Na tela inicial, toque em "Começar agora". Preencha seu nome, e-mail e senha, confirme a senha e toque em "Criar conta".',
      },
      {
        pergunta: 'Como edito meu perfil?',
        resposta:
          'Vá até a aba Perfil e toque em "Editar perfil". Altere seu nome ou e-mail e toque em "Salvar alterações".',
      },
      {
        pergunta: 'Esqueci minha senha. E agora?',
        resposta:
          'Na tela de login, toque em "Esqueci minha senha" e digite seu e-mail. Você vai receber um link com um código. Depois, toque em "Já tenho o código" e crie uma nova senha.',
      },
      {
        pergunta: 'Como saio da minha conta?',
        resposta: 'Na aba Perfil, role até o final e toque em "Sair da conta".',
      },
    ],
  },
  {
    assunto: 'Livros e busca',
    cor: Accent.lilac,
    icone: { ios: 'magnifyingglass', android: 'search', web: 'search' },
    perguntas: [
      {
        pergunta: 'Como encontro um livro?',
        resposta:
          'Use a busca da Home ou abra a aba Explore. Digite o título ou o nome do autor, por exemplo "Machado de Assis". Você também pode usar os filtros para refinar a busca.',
      },
      {
        pergunta: 'De onde vêm as informações dos livros?',
        resposta:
          'Os títulos, autores, capas e descrições vêm da Open Library, um catálogo aberto e gratuito de livros do mundo todo.',
      },
    ],
  },
  {
    assunto: 'Minha biblioteca',
    cor: Accent.laurel,
    icone: { ios: 'books.vertical.fill', android: 'library_books', web: 'library_books' },
    perguntas: [
      {
        pergunta: 'Como organizo minha estante?',
        resposta:
          'Na aba Biblioteca, cada livro tem um status: "Quero ler", "Lendo" ou "Lido". Toque no status do livro para trocar.',
      },
      {
        pergunta: 'Posso ver só os livros que estou lendo?',
        resposta:
          'Sim! No topo da aba Biblioteca existem filtros. Escolha um status para ver só os livros dele.',
      },
    ],
  },
] as const;

export default function AjudaScreen() {
  const router = useRouter();

  // Guarda qual pergunta está aberta (null = nenhuma)
  const [aberta, setAberta] = useState<string | null>(null);

  // Abre a pergunta tocada. Se ela já estava aberta, fecha.
  function alternarPergunta(pergunta: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAberta((atual) => (atual === pergunta ? null : pergunta));
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
              name={{ ios: 'questionmark.circle.fill', android: 'help', web: 'help' }}
              size={36}
              tintColor={Mint.mint400}
            />
          </View>
          <Text style={styles.titulo}>Ajuda e FAQ</Text>
          <Text style={styles.subtitulo}>
            Tire suas dúvidas sobre o Alexandria. Toque em uma pergunta para ver a resposta.
          </Text>
        </View>

        {/* Uma seção para cada assunto */}
        {FAQ.map((secao) => (
          <View key={secao.assunto}>
            <View style={styles.secaoCabecalho}>
              <View style={[styles.secaoIcone, { backgroundColor: withAlpha(secao.cor, 0.15) }]}>
                <SymbolView name={secao.icone} size={14} tintColor={secao.cor} />
              </View>
              <Text style={styles.secaoTitulo}>{secao.assunto}</Text>
            </View>

            <View style={styles.cartao}>
              {secao.perguntas.map((item, index) => {
                const estaAberta = aberta === item.pergunta;

                return (
                  <Pressable
                    key={item.pergunta}
                    onPress={() => alternarPergunta(item.pergunta)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: estaAberta }}
                    style={({ pressed }) => [
                      styles.item,
                      index > 0 && styles.comBorda,
                      pressed && styles.itemPressionado,
                    ]}>
                    <View style={styles.perguntaLinha}>
                      <Text style={[styles.pergunta, estaAberta && { color: secao.cor }]}>
                        {item.pergunta}
                      </Text>
                      <SymbolView
                        name={
                          estaAberta
                            ? { ios: 'chevron.up', android: 'expand_less', web: 'expand_less' }
                            : { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }
                        }
                        size={18}
                        tintColor={estaAberta ? secao.cor : TextColor.muted}
                      />
                    </View>

                    {/* A resposta só aparece quando a pergunta está aberta */}
                    {estaAberta && <Text style={styles.resposta}>{item.resposta}</Text>}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}

        {/* Cartão final: ainda com dúvidas */}
        <View style={styles.contato}>
          <SymbolView
            name={{ ios: 'bubble.left.and.bubble.right.fill', android: 'forum', web: 'forum' }}
            size={28}
            tintColor={Mint.mint400}
          />
          <Text style={styles.contatoTitulo}>Ainda tem dúvidas?</Text>
          <Text style={styles.contatoTexto}>
            Fale com a equipe que criou o Alexandria. A gente ajuda!
          </Text>
          <Pressable
            onPress={() => router.push('/equipe')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.botao, pressed && styles.botaoPressionado]}>
            <Text style={styles.botaoTexto}>Conhecer a equipe</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: Ink.ink900 },
  conteudo: { padding: ScreenInset, paddingBottom: Space.twelve },

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
    backgroundColor: withAlpha(Mint.mint400, 0.15),
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
    lineHeight: 22,
    color: TextColor.secondary,
    textAlign: 'center',
  },

  // Título de cada assunto
  secaoCabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.two,
    marginTop: Space.eight,
    marginBottom: Space.two,
  },
  secaoIcone: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secaoTitulo: {
    fontFamily: DSFonts.ui,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: TextColor.secondary,
  },

  // Cartão com as perguntas
  cartao: {
    backgroundColor: Ink.ink700,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Ink.ink500,
    overflow: 'hidden',
  },
  item: { paddingHorizontal: Space.four, paddingVertical: Space.four },
  itemPressionado: { backgroundColor: Ink.ink600 },
  comBorda: { borderTopWidth: 1, borderTopColor: Ink.ink500 },
  perguntaLinha: { flexDirection: 'row', alignItems: 'center', gap: Space.three },
  pergunta: {
    flex: 1,
    fontFamily: DSFonts.ui,
    fontSize: 16,
    fontWeight: '600',
    color: TextColor.primary,
  },
  resposta: {
    marginTop: Space.three,
    fontFamily: DSFonts.ui,
    fontSize: 14,
    lineHeight: 22,
    color: TextColor.secondary,
  },

  // Cartão final
  contato: {
    alignItems: 'center',
    marginTop: Space.eight,
    padding: Space.six,
    backgroundColor: withAlpha(Mint.mint400, 0.08),
    borderRadius: Radius.sheet,
    borderWidth: 1,
    borderColor: withAlpha(Mint.mint400, 0.3),
  },
  contatoTitulo: {
    marginTop: Space.three,
    fontFamily: DSFonts.display,
    fontSize: 20,
    color: TextColor.primary,
  },
  contatoTexto: {
    marginTop: Space.one,
    fontFamily: DSFonts.ui,
    fontSize: 14,
    lineHeight: 20,
    color: TextColor.secondary,
    textAlign: 'center',
  },
  botao: {
    marginTop: Space.four,
    paddingHorizontal: Space.six,
    paddingVertical: Space.three,
    borderRadius: Radius.pill,
    backgroundColor: Mint.mint400,
  },
  botaoPressionado: { backgroundColor: Mint.mint500 },
  botaoTexto: { fontFamily: DSFonts.ui, fontSize: 14, fontWeight: '700', color: Ink.ink900 },
});
