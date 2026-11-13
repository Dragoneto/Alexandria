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
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BotaoVoltar } from '@/components/botao-voltar';
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
import {
  FAQ,
  MAIS_PROCURADAS,
  filtrarFaq,
  partesDestacadas,
  type Assunto,
  type Pergunta,
} from '@/constants/faq';
import { useFoco } from '@/hooks/use-foco';

const VISUAL: Record<Assunto, { cor: string; icone: SymbolViewProps['name'] }> = {
  Conta: {
    cor: Accent.sapphire,
    icone: { ios: 'person.crop.circle.fill', android: 'account_circle', web: 'account_circle' },
  },
  'Livros e busca': {
    cor: Accent.lilac,
    icone: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  },
  'Minha biblioteca': {
    cor: Accent.laurel,
    icone: { ios: 'books.vertical.fill', android: 'library_books', web: 'library_books' },
  },
  'Tracker de leitura': {
    cor: Accent.amber,
    icone: { ios: 'chart.bar.fill', android: 'insights', web: 'insights' },
  },
  'Avaliações e conversas': {
    cor: Accent.coral,
    icone: { ios: 'star.bubble.fill', android: 'reviews', web: 'reviews' },
  },
  'Problemas comuns': {
    cor: Mint.mint400,
    icone: { ios: 'wrench.and.screwdriver.fill', android: 'build', web: 'build' },
  },
};

const TOTAL = FAQ.reduce((soma, secao) => soma + secao.perguntas.length, 0);

// Junta cada pergunta procurada com o assunto dela, para usar a cor certa.
const PROCURADAS = MAIS_PROCURADAS.flatMap((texto) => {
  const secao = FAQ.find((s) => s.perguntas.some((p) => p.pergunta === texto));
  const item = secao?.perguntas.find((p) => p.pergunta === texto);
  return secao && item ? [{ assunto: secao.assunto, item }] : [];
});

export default function AjudaScreen() {
  const router = useRouter();
  const [busca, setBusca] = useState('');
  const { focado: buscaFocada, propsDeFoco } = useFoco();
  const [assunto, setAssunto] = useState<Assunto | null>(null);
  // Chave "lugar|pergunta": a mesma pergunta pode estar nas mais procuradas e na seção.
  const [aberta, setAberta] = useState<string | null>(null);

  const secoes = useMemo(() => filtrarFaq(FAQ, busca, assunto), [busca, assunto]);
  const encontradas = secoes.reduce((soma, secao) => soma + secao.perguntas.length, 0);
  const filtrando = busca.trim().length > 0 || assunto !== null;

  function alternar(chave: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAberta((atual) => (atual === chave ? null : chave));
  }

  function escolherAssunto(novo: Assunto | null) {
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
        <View style={styles.voltar}>
          <BotaoVoltar fallback="/configuracoes" />
        </View>

        <View style={styles.cabecalho}>
          <Text style={styles.rotulo}>Central de ajuda</Text>
          <Text accessibilityRole="header" style={styles.titulo}>
            Como podemos ajudar?
          </Text>
          <Text style={styles.subtitulo}>
            {TOTAL} respostas sobre conta, livros, biblioteca, tracker e conversas.
          </Text>
        </View>

        <View style={[styles.busca, buscaFocada && styles.buscaFocada]}>
          <SymbolView
            name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
            size={18}
            tintColor={TextColor.secondary}
          />
          <TextInput
            {...propsDeFoco}
            style={styles.buscaInput}
            accessibilityLabel="Buscar uma dúvida"
            placeholder="Buscar: senha, páginas, capa…"
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
              accessibilityLabel="Limpar busca"
              style={styles.limpar}>
              <SymbolView
                name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }}
                size={18}
                tintColor={TextColor.secondary}
              />
            </Pressable>
          )}
        </View>

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
              icone={VISUAL[secao.assunto].icone}
              cor={VISUAL[secao.assunto].cor}
              ativo={assunto === secao.assunto}
              onPress={() => escolherAssunto(secao.assunto)}
            />
          ))}
        </ScrollView>

        {filtrando && encontradas > 0 && (
          <Text style={styles.resultado} accessibilityLiveRegion="polite">
            {encontradas === 1 ? '1 resposta encontrada' : `${encontradas} respostas encontradas`}
          </Text>
        )}

        {/* Atalho para as dúvidas mais comuns, só quando não há busca nem filtro */}
        {!filtrando && (
          <View style={styles.secao}>
            <View style={styles.secaoCabecalho}>
              <View style={[styles.secaoIcone, { backgroundColor: withAlpha(Mint.mint400, 0.15) }]}>
                <SymbolView
                  name={{ ios: 'flame.fill', android: 'trending_up', web: 'trending_up' }}
                  size={16}
                  tintColor={Mint.mint400}
                />
              </View>
              <Text style={styles.secaoTitulo}>Mais procuradas</Text>
            </View>
            {PROCURADAS.map(({ assunto: deQual, item }) => (
              <ItemPergunta
                key={`top|${item.pergunta}`}
                {...item}
                cor={VISUAL[deQual].cor}
                termo=""
                aberta={aberta === `top|${item.pergunta}`}
                onPress={() => alternar(`top|${item.pergunta}`)}
                onAcao={(rota) => router.push(rota)}
              />
            ))}
          </View>
        )}

        {secoes.map((secao) => (
          <View key={secao.assunto} style={styles.secao}>
            <View style={styles.secaoCabecalho}>
              <View
                style={[
                  styles.secaoIcone,
                  { backgroundColor: withAlpha(VISUAL[secao.assunto].cor, 0.15) },
                ]}>
                <SymbolView
                  name={VISUAL[secao.assunto].icone}
                  size={16}
                  tintColor={VISUAL[secao.assunto].cor}
                />
              </View>
              <Text style={styles.secaoTitulo}>{secao.assunto}</Text>
              <Text style={styles.secaoContagem}>
                {secao.perguntas.length} {secao.perguntas.length === 1 ? 'pergunta' : 'perguntas'}
              </Text>
            </View>

            {secao.perguntas.map((item) => (
              <ItemPergunta
                key={item.pergunta}
                {...item}
                cor={VISUAL[secao.assunto].cor}
                termo={busca}
                // Com uma busca, as respostas já aparecem abertas para mostrar o trecho achado.
                aberta={busca.trim().length > 1 || aberta === `${secao.assunto}|${item.pergunta}`}
                onPress={() => alternar(`${secao.assunto}|${item.pergunta}`)}
                onAcao={(rota) => router.push(rota)}
              />
            ))}
          </View>
        ))}

        {secoes.length === 0 && (
          <View style={styles.vazio}>
            <SymbolView
              name={{ ios: 'magnifyingglass', android: 'search_off', web: 'search_off' }}
              size={28}
              tintColor={TextColor.secondary}
            />
            <Text style={styles.vazioTitulo}>Nenhuma resposta para “{busca.trim()}”</Text>
            <Text style={styles.vazioTexto}>
              Tente uma palavra só, como “senha”, “capa” ou “páginas”, ou veja todas as perguntas.
            </Text>
            <Pressable
              onPress={limparFiltros}
              accessibilityRole="button"
              style={({ pressed }) => [styles.botaoSecundario, pressed && styles.pressionado]}>
              <Text style={styles.botaoSecundarioTexto}>Ver todas as perguntas</Text>
            </Pressable>
          </View>
        )}

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
      accessibilityRole="radio"
      accessibilityState={{ checked: ativo }}
      style={({ pressed }) => [
        styles.chip,
        ativo && { backgroundColor: withAlpha(cor, 0.14), borderColor: withAlpha(cor, 0.5) },
        pressed && styles.pressionado,
      ]}>
      {icone && <SymbolView name={icone} size={14} tintColor={cor} />}
      <Text style={[styles.chipTexto, ativo && { color: cor }]}>{titulo}</Text>
    </Pressable>
  );
}

/** Texto com o termo buscado destacado (a comparação ignora acentos). */
function Destacado({ texto, termo, style }: { texto: string; termo: string; style: object }) {
  return (
    <Text style={style}>
      {partesDestacadas(texto, termo).map((parte, index) =>
        parte.destaque ? (
          <Text key={index} style={styles.marca}>
            {parte.texto}
          </Text>
        ) : (
          parte.texto
        ),
      )}
    </Text>
  );
}

type ItemPerguntaProps = Pergunta & {
  cor: string;
  termo: string;
  aberta: boolean;
  onPress: () => void;
  onAcao: (rota: NonNullable<Pergunta['acao']>['rota']) => void;
};

function ItemPergunta({
  pergunta,
  resposta,
  acao,
  cor,
  termo,
  aberta,
  onPress,
  onAcao,
}: ItemPerguntaProps) {
  // Giro da seta: 0 = para baixo (fechada), 1 = para cima (aberta)
  const giro = useSharedValue(aberta ? 1 : 0);

  useEffect(() => {
    giro.set(withTiming(aberta ? 1 : 0, { duration: 250 }));
  }, [aberta, giro]);

  const setaStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${giro.value * 180}deg` }],
  }));

  return (
    <View style={[styles.item, aberta && { borderColor: withAlpha(cor, 0.4) }]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ expanded: aberta }}
        style={({ pressed }) => [styles.perguntaLinha, pressed && styles.pressionado]}>
        <Destacado
          texto={pergunta}
          termo={termo}
          style={[styles.pergunta, aberta && { color: cor }]}
        />
        <Animated.View style={setaStyle}>
          <SymbolView
            name={{ ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }}
            size={18}
            tintColor={aberta ? cor : TextColor.secondary}
          />
        </Animated.View>
      </Pressable>

      {aberta && (
        <Animated.View entering={FadeIn.duration(200)}>
          <Destacado texto={resposta} termo={termo} style={styles.resposta} />
          {acao && (
            <Pressable
              onPress={() => onAcao(acao.rota)}
              accessibilityRole="link"
              style={({ pressed }) => [styles.acao, pressed && styles.pressionado]}>
              <Text style={[styles.acaoTexto, { color: cor }]}>{acao.rotulo}</Text>
              <SymbolView
                name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }}
                size={14}
                tintColor={cor}
              />
            </Pressable>
          )}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: Ink.ink900 },
  conteudo: { paddingTop: Space.four, paddingBottom: Space.twelve },
  pressionado: { opacity: 0.7 },

  voltar: { paddingHorizontal: ScreenInset },
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
  subtitulo: {
    marginTop: Space.one,
    fontFamily: DSFonts.ui,
    fontSize: 15,
    lineHeight: 22,
    color: TextColor.secondary,
  },

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
    borderWidth: 1,
    borderColor: 'transparent',
  },
  buscaFocada: { borderColor: Mint.mint400 },
  // O campo ocupa a altura toda da pílula: tocar em qualquer ponto dela já abre o teclado.
  buscaInput: {
    flex: 1,
    alignSelf: 'stretch',
    fontFamily: DSFonts.ui,
    fontSize: 16,
    color: TextColor.primary,
    // Sem o contorno do navegador: a borda de foco já é do próprio campo.
    outlineWidth: 0,
    outlineStyle: 'solid',
  },
  limpar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  chipsLista: { marginTop: Space.four, flexGrow: 0 },
  chips: { paddingHorizontal: ScreenInset, gap: Space.two },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.two,
    minHeight: 44,
    paddingHorizontal: Space.four,
    borderRadius: Radius.pill,
    backgroundColor: Ink.ink600,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipTexto: {
    fontFamily: DSFonts.ui,
    fontSize: 14,
    fontWeight: '600',
    color: TextColor.secondary,
  },
  resultado: {
    marginTop: Space.four,
    paddingHorizontal: ScreenInset,
    fontFamily: DSFonts.ui,
    fontSize: 13,
    fontWeight: '600',
    color: TextColor.secondary,
  },

  secao: { marginTop: Space.eight, paddingHorizontal: ScreenInset, gap: Space.three },
  secaoCabecalho: { flexDirection: 'row', alignItems: 'center', gap: Space.three },
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

  item: {
    borderRadius: Radius.card,
    backgroundColor: Ink.ink700,
    borderWidth: 1,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  perguntaLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.three,
    padding: Space.four,
    minHeight: 56,
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
    paddingHorizontal: Space.four,
    paddingBottom: Space.four,
    fontFamily: DSFonts.ui,
    fontSize: 15,
    lineHeight: 23,
    color: TextColor.secondary,
  },
  marca: {
    color: TextColor.primary,
    backgroundColor: withAlpha(Accent.amber, 0.28),
    fontWeight: '700',
  },
  acao: {
    alignSelf: 'flex-start',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.two,
    marginHorizontal: Space.four,
    marginBottom: Space.two,
  },
  acaoTexto: { fontFamily: DSFonts.ui, fontSize: 14, fontWeight: '700' },

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
    textAlign: 'center',
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

  contato: {
    gap: Space.four,
    marginTop: Space.eight,
    marginHorizontal: ScreenInset,
    padding: Space.six,
    borderRadius: Radius.sheet,
    backgroundColor: Ink.ink700,
    ...Shadow.e1,
  },
  contatoTopo: { flexDirection: 'row', alignItems: 'center', gap: Space.four },
  contatoIcone: {
    width: 48,
    height: 48,
    borderRadius: Radius.pill,
    backgroundColor: Mint.mint900,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contatoTextos: { flex: 1, gap: Space.one },
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
  botaoPressionado: { backgroundColor: Mint.mint500 },
  botaoTexto: { fontFamily: DSFonts.ui, fontSize: 15, fontWeight: '700', color: Ink.ink900 },
});
