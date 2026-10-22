import { useRouter } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
import {
  LayoutAnimation,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Accent,
  DSFonts,
  Ink,
  Mint,
  Radius,
  ScreenInset,
  Shadow,
  Space,
  TextColor,
  withAlpha,
} from '@/constants/design-system';

type Pergunta = { pergunta: string; resposta: string };

type Secao = {
  assunto: string;
  cor: string;
  icone: SymbolViewProps['name'];
  perguntas: Pergunta[];
};

// Perguntas separadas por assunto. Cada assunto vira uma seção na tela.
const FAQ: Secao[] = [
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
];

// Tira acentos e deixa tudo minúsculo: assim "senha" acha "Senha" e "historia" acha "História"
function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export default function AjudaScreen() {
  const router = useRouter();
  const [busca, setBusca] = useState('');
  const [assunto, setAssunto] = useState<string | null>(null); // null = todos os assuntos
  const [aberta, setAberta] = useState<string | null>(null); // null = nenhuma pergunta aberta

  // Seções que aparecem na tela, já filtradas pelo assunto escolhido e pelo texto da busca
  const secoes = useMemo(() => {
    const termo = normalizar(busca.trim());

    return FAQ.filter((secao) => assunto === null || secao.assunto === assunto)
      .map((secao) => ({
        ...secao,
        perguntas: secao.perguntas.filter((item) =>
          normalizar(`${item.pergunta} ${item.resposta}`).includes(termo),
        ),
      }))
      .filter((secao) => secao.perguntas.length > 0);
  }, [busca, assunto]);

  // Abre a pergunta tocada. Se ela já estava aberta, fecha.
  function alternarPergunta(pergunta: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAberta((atual) => (atual === pergunta ? null : pergunta));
  }

  function escolherAssunto(novo: string | null) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAssunto(novo);
  }

  function limparFiltros() {
    setBusca('');
    setAssunto(null);
  }

  return (
    <SafeAreaView style={styles.tela} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.conteudo}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
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

        {/* Cabeçalho no mesmo formato da Home: rótulo pequeno + título serifado */}
        <View style={styles.cabecalho}>
          <Text style={styles.rotulo}>Central de ajuda</Text>
          <Text style={styles.titulo}>Como podemos ajudar?</Text>
          <Text style={styles.subtitulo}>Respostas rápidas para as dúvidas mais comuns.</Text>
        </View>

        {/* Busca: a mesma pílula da Home */}
        <View style={styles.busca}>
          <SymbolView
            name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
            size={18}
            tintColor={TextColor.secondary}
          />
          <TextInput
            style={styles.buscaInput}
            placeholder="Buscar uma dúvida"
            placeholderTextColor={TextColor.muted}
            value={busca}
            onChangeText={setBusca}
            returnKeyType="search"
            selectionColor={Mint.mint400}
          />
          {busca.length > 0 && (
            <Pressable
              onPress={() => setBusca('')}
              hitSlop={Space.two}
              accessibilityRole="button"
              accessibilityLabel="Limpar busca">
              <SymbolView
                name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }}
                size={18}
                tintColor={TextColor.muted}
              />
            </Pressable>
          )}
        </View>

        {/* Filtro por assunto, rolando para o lado como as estantes da Home */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsLista}
          contentContainerStyle={styles.chips}>
          <Chip titulo="Todas" ativo={assunto === null} onPress={() => escolherAssunto(null)} />
          {FAQ.map((secao) => (
            <Chip
              key={secao.assunto}
              titulo={secao.assunto}
              icone={secao.icone}
              cor={secao.cor}
              ativo={assunto === secao.assunto}
              onPress={() => escolherAssunto(secao.assunto)}
            />
          ))}
        </ScrollView>

        {/* Uma seção para cada assunto */}
        {secoes.map((secao) => (
          <View key={secao.assunto} style={styles.secao}>
            <View style={styles.secaoCabecalho}>
              <View style={[styles.secaoIcone, { backgroundColor: withAlpha(secao.cor, 0.15) }]}>
                <SymbolView name={secao.icone} size={16} tintColor={secao.cor} />
              </View>
              <Text style={styles.secaoTitulo}>{secao.assunto}</Text>
              <Text style={styles.secaoContagem}>
                {secao.perguntas.length} {secao.perguntas.length === 1 ? 'pergunta' : 'perguntas'}
              </Text>
            </View>

            {secao.perguntas.map((item) => (
              <ItemPergunta
                key={item.pergunta}
                pergunta={item.pergunta}
                resposta={item.resposta}
                cor={secao.cor}
                aberta={aberta === item.pergunta}
                onPress={() => alternarPergunta(item.pergunta)}
              />
            ))}
          </View>
        ))}

        {/* Nada encontrado na busca */}
        {secoes.length === 0 && (
          <View style={styles.vazio}>
            <SymbolView
              name={{ ios: 'magnifyingglass', android: 'search_off', web: 'search_off' }}
              size={28}
              tintColor={TextColor.secondary}
            />
            <Text style={styles.vazioTitulo}>Nenhuma dúvida encontrada</Text>
            <Text style={styles.vazioTexto}>Tente outras palavras ou veja todas as perguntas.</Text>
            <Pressable
              onPress={limparFiltros}
              accessibilityRole="button"
              style={({ pressed }) => [styles.botaoSecundario, pressed && styles.pressionado]}>
              <Text style={styles.botaoSecundarioTexto}>Ver todas</Text>
            </Pressable>
          </View>
        )}

        {/* Cartão final: ainda com dúvidas */}
        <View style={styles.contato}>
          <View style={styles.contatoTopo}>
            <View style={styles.contatoIcone}>
              <SymbolView
                name={{ ios: 'bubble.left.and.bubble.right.fill', android: 'forum', web: 'forum' }}
                size={22}
                tintColor={Mint.mint400}
              />
            </View>
            <View style={styles.contatoTextos}>
              <Text style={styles.contatoTitulo}>Ainda tem dúvidas?</Text>
              <Text style={styles.contatoTexto}>Fale com a equipe que criou o Alexandria.</Text>
            </View>
          </View>

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

type ChipProps = {
  titulo: string;
  ativo: boolean;
  onPress: () => void;
  icone?: SymbolViewProps['name'];
  cor?: string;
};

function Chip({ titulo, ativo, onPress, icone, cor = Mint.mint400 }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: ativo }}
      style={({ pressed }) => [styles.chip, ativo && styles.chipAtivo, pressed && styles.pressionado]}>
      {icone && <SymbolView name={icone} size={14} tintColor={ativo ? Mint.mint400 : cor} />}
      <Text style={[styles.chipTexto, ativo && styles.chipTextoAtivo]}>{titulo}</Text>
    </Pressable>
  );
}

type ItemPerguntaProps = Pergunta & {
  cor: string;
  aberta: boolean;
  onPress: () => void;
};

function ItemPergunta({ pergunta, resposta, cor, aberta, onPress }: ItemPerguntaProps) {
  // Giro da seta: 0 = apontando para baixo, 1 = apontando para cima
  const giro = useSharedValue(aberta ? 1 : 0);

  useEffect(() => {
    giro.value = withTiming(aberta ? 1 : 0, { duration: 250 });
  }, [aberta, giro]);

  const setaStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${giro.value * 180}deg` }],
  }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded: aberta }}
      style={({ pressed }) => [
        styles.item,
        aberta && { borderColor: withAlpha(cor, 0.4) },
        pressed && styles.pressionado,
      ]}>
      <View style={styles.perguntaLinha}>
        <Text style={[styles.pergunta, aberta && { color: cor }]}>{pergunta}</Text>
        <Animated.View style={setaStyle}>
          <SymbolView
            name={{ ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }}
            size={18}
            tintColor={aberta ? cor : TextColor.secondary}
          />
        </Animated.View>
      </View>

      {/* A resposta só aparece quando a pergunta está aberta */}
      {aberta && <Text style={styles.resposta}>{resposta}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: Ink.ink900,
  },
  conteudo: {
    paddingTop: Space.four,
    paddingBottom: Space.twelve,
  },
  pressionado: {
    opacity: 0.7,
  },

  // Cabeçalho
  voltar: {
    width: 44,
    height: 44,
    marginLeft: ScreenInset,
    borderRadius: Radius.pill,
    backgroundColor: Ink.ink600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cabecalho: {
    marginTop: Space.six,
    paddingHorizontal: ScreenInset,
    gap: Space.one,
  },
  rotulo: {
    fontFamily: DSFonts.ui,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.76,
    textTransform: 'uppercase',
    color: TextColor.secondary,
  },
  titulo: {
    fontFamily: DSFonts.display,
    fontSize: 28,
    lineHeight: 34,
    color: TextColor.primary,
  },
  subtitulo: {
    marginTop: Space.one,
    fontFamily: DSFonts.ui,
    fontSize: 15,
    lineHeight: 22,
    color: TextColor.secondary,
  },

  // Busca
  busca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.three,
    marginTop: Space.six,
    marginHorizontal: ScreenInset,
    paddingHorizontal: Space.four,
    minHeight: 48,
    borderRadius: Radius.pill,
    backgroundColor: Ink.ink700,
  },
  buscaInput: {
    flex: 1,
    fontFamily: DSFonts.ui,
    fontSize: 16,
    color: TextColor.primary,
  },

  // Filtro por assunto
  chipsLista: {
    marginTop: Space.four,
    flexGrow: 0,
  },
  chips: {
    paddingHorizontal: ScreenInset,
    gap: Space.two,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.two,
    height: 36,
    paddingHorizontal: Space.four,
    borderRadius: Radius.pill,
    backgroundColor: Ink.ink600,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipAtivo: {
    backgroundColor: Mint.mint900,
    borderColor: withAlpha(Mint.mint400, 0.4),
  },
  chipTexto: {
    fontFamily: DSFonts.ui,
    fontSize: 14,
    fontWeight: '600',
    color: TextColor.secondary,
  },
  chipTextoAtivo: {
    color: Mint.mint400,
  },

  // Seções
  secao: {
    marginTop: Space.eight,
    paddingHorizontal: ScreenInset,
    gap: Space.three,
  },
  secaoCabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.three,
  },
  secaoIcone: {
    width: 32,
    height: 32,
    borderRadius: Radius.cover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secaoTitulo: {
    flex: 1,
    fontFamily: DSFonts.display,
    fontSize: 20,
    lineHeight: 26,
    color: TextColor.primary,
  },
  secaoContagem: {
    fontFamily: DSFonts.ui,
    fontSize: 12,
    fontWeight: '600',
    color: TextColor.secondary,
  },

  // Pergunta
  item: {
    padding: Space.four,
    borderRadius: Radius.card,
    backgroundColor: Ink.ink700,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  perguntaLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.three,
  },
  pergunta: {
    flex: 1,
    fontFamily: DSFonts.ui,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    color: TextColor.primary,
  },
  resposta: {
    marginTop: Space.three,
    fontFamily: DSFonts.ui,
    fontSize: 15,
    lineHeight: 22,
    color: TextColor.secondary,
  },

  // Nada encontrado
  vazio: {
    alignItems: 'center',
    gap: Space.two,
    marginTop: Space.eight,
    marginHorizontal: ScreenInset,
    padding: Space.six,
    borderRadius: Radius.card,
    backgroundColor: Ink.ink700,
  },
  vazioTitulo: {
    marginTop: Space.two,
    fontFamily: DSFonts.display,
    fontSize: 18,
    lineHeight: 24,
    color: TextColor.primary,
  },
  vazioTexto: {
    fontFamily: DSFonts.ui,
    fontSize: 14,
    lineHeight: 20,
    color: TextColor.secondary,
    textAlign: 'center',
  },
  botaoSecundario: {
    marginTop: Space.two,
    paddingHorizontal: Space.six,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: withAlpha(Mint.mint400, 0.4),
  },
  botaoSecundarioTexto: {
    fontFamily: DSFonts.ui,
    fontSize: 14,
    fontWeight: '700',
    color: Mint.mint400,
  },

  // Cartão final
  contato: {
    gap: Space.four,
    marginTop: Space.eight,
    marginHorizontal: ScreenInset,
    padding: Space.six,
    borderRadius: Radius.sheet,
    backgroundColor: Ink.ink700,
    ...Shadow.e1,
  },
  contatoTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.four,
  },
  contatoIcone: {
    width: 48,
    height: 48,
    borderRadius: Radius.pill,
    backgroundColor: Mint.mint900,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contatoTextos: {
    flex: 1,
    gap: Space.one,
  },
  contatoTitulo: {
    fontFamily: DSFonts.display,
    fontSize: 20,
    lineHeight: 26,
    color: TextColor.primary,
  },
  contatoTexto: {
    fontFamily: DSFonts.ui,
    fontSize: 14,
    lineHeight: 20,
    color: TextColor.secondary,
  },
  botao: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
    backgroundColor: Mint.mint400,
  },
  botaoPressionado: {
    backgroundColor: Mint.mint500,
  },
  botaoTexto: {
    fontFamily: DSFonts.ui,
    fontSize: 15,
    fontWeight: '700',
    color: Ink.ink900,
  },
});
