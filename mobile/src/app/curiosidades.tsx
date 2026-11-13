import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewInstance,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BotaoVoltar } from '@/components/botao-voltar';
import {
  CATEGORIAS_CURIOSIDADES,
  CURIOSIDADES,
  sortearOutra,
  type CategoriaCuriosidade,
  type Curiosidade,
} from '@/constants/curiosidades';
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

// A lista cresce de 6 em 6 por botão, em vez de rolar sem fim.
const POR_VEZ = 6;

type Filtro = CategoriaCuriosidade | 'Todas';

const VISUAL: Record<CategoriaCuriosidade, { cor: string; icone: SymbolViewProps['name'] }> = {
  História: {
    cor: Accent.amber,
    icone: { ios: 'building.columns.fill', android: 'account_balance', web: 'account_balance' },
  },
  Literatura: {
    cor: Accent.lilac,
    icone: { ios: 'book.closed.fill', android: 'menu_book', web: 'menu_book' },
  },
  Brasil: { cor: Accent.laurel, icone: { ios: 'flag.fill', android: 'flag', web: 'flag' } },
  Palavras: {
    cor: Accent.coral,
    icone: { ios: 'character.book.closed.fill', android: 'spellcheck', web: 'spellcheck' },
  },
  Ciência: { cor: Mint.mint400, icone: { ios: 'flask.fill', android: 'science', web: 'science' } },
  Invenções: {
    cor: Accent.sapphire,
    icone: { ios: 'printer.fill', android: 'print', web: 'print' },
  },
  Recordes: {
    cor: Accent.amber,
    icone: { ios: 'trophy.fill', android: 'emoji_events', web: 'emoji_events' },
  },
  Bibliotecas: {
    cor: Accent.sapphire,
    icone: { ios: 'books.vertical.fill', android: 'local_library', web: 'local_library' },
  },
};

const plural = (n: number) => (n === 1 ? '1 curiosidade' : `${n} curiosidades`);

export default function CuriosidadesScreen() {
  const reduzirMovimento = useReducedMotion();
  const rolagem = useRef<ScrollViewInstance>(null);
  const [filtro, setFiltro] = useState<Filtro>('Todas');
  const [destaque, setDestaque] = useState<Curiosidade>(CURIOSIDADES[0]);
  const [visiveis, setVisiveis] = useState(POR_VEZ);

  const lista = useMemo(
    () => (filtro === 'Todas' ? CURIOSIDADES : CURIOSIDADES.filter((c) => c.categoria === filtro)),
    [filtro],
  );
  const contagem = useMemo(() => {
    const porCategoria = Object.fromEntries(CATEGORIAS_CURIOSIDADES.map((c) => [c, 0])) as Record<
      CategoriaCuriosidade,
      number
    >;
    for (const item of CURIOSIDADES) porCategoria[item.categoria] += 1;
    return porCategoria;
  }, []);

  const visual = VISUAL[destaque.categoria];
  const restantes = Math.max(0, lista.length - visiveis);

  const escolherFiltro = (novo: Filtro) => {
    setFiltro(novo);
    setVisiveis(POR_VEZ);
    // O destaque acompanha a categoria escolhida.
    if (novo !== 'Todas' && destaque.categoria !== novo) {
      const primeira = CURIOSIDADES.find((c) => c.categoria === novo);
      if (primeira) setDestaque(primeira);
    }
  };

  const outra = () => {
    const sorteada = sortearOutra(lista, destaque.id);
    if (sorteada) setDestaque(sorteada);
  };

  const colocarEmDestaque = (item: Curiosidade) => {
    setDestaque(item);
    rolagem.current?.scrollTo({ y: 0, animated: !reduzirMovimento });
  };

  return (
    <SafeAreaView style={styles.tela}>
      <ScrollView ref={rolagem} contentContainerStyle={styles.conteudo}>
        <BotaoVoltar fallback="/configuracoes" />

        <View style={styles.cabecalho}>
          <View style={styles.cabecalhoIcone}>
            <SymbolView
              name={{ ios: 'lightbulb.fill', android: 'lightbulb', web: 'lightbulb' }}
              size={32}
              tintColor={Accent.amber}
            />
          </View>
          <Text accessibilityRole="header" style={styles.titulo}>
            Você sabia?
          </Text>
          <Text style={styles.subtitulo}>
            {plural(CURIOSIDADES.length)} sobre livros, leitura e bibliotecas.
          </Text>
        </View>

        {/* Destaque: troca com um fade curto a cada curiosidade */}
        <Animated.View
          key={destaque.id}
          entering={reduzirMovimento ? undefined : FadeIn.duration(250)}
          style={[styles.destaque, { borderColor: withAlpha(visual.cor, 0.5) }]}>
          <View style={[styles.selo, { backgroundColor: withAlpha(visual.cor, 0.15) }]}>
            <SymbolView name={visual.icone} size={14} tintColor={visual.cor} />
            <Text style={[styles.seloTexto, { color: visual.cor }]}>{destaque.categoria}</Text>
          </View>
          <Text style={styles.destaqueTexto} accessibilityLiveRegion="polite">
            {destaque.texto}
          </Text>
          <Pressable
            onPress={outra}
            disabled={lista.length < 2}
            accessibilityRole="button"
            accessibilityLabel={
              filtro === 'Todas' ? 'Outra curiosidade' : `Outra curiosidade de ${filtro}`
            }
            style={({ pressed }) => [styles.botao, pressed && styles.pressionado]}>
            <SymbolView
              name={{ ios: 'shuffle', android: 'shuffle', web: 'shuffle' }}
              size={16}
              tintColor={Ink.ink900}
            />
            <Text style={styles.botaoTexto}>Outra curiosidade</Text>
          </Pressable>
        </Animated.View>

        {/* Categorias com a contagem, como os filtros da biblioteca */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsLista}
          contentContainerStyle={styles.chips}>
          {(['Todas', ...CATEGORIAS_CURIOSIDADES] as Filtro[]).map((opcao) => {
            const ativo = filtro === opcao;
            const n = opcao === 'Todas' ? CURIOSIDADES.length : contagem[opcao];
            const cor = opcao === 'Todas' ? Mint.mint400 : VISUAL[opcao].cor;
            return (
              <Pressable
                key={opcao}
                onPress={() => escolherFiltro(opcao)}
                accessibilityRole="radio"
                accessibilityState={{ checked: ativo }}
                accessibilityLabel={`${opcao}, ${plural(n)}`}
                style={({ pressed }) => [
                  styles.chip,
                  ativo && { borderColor: cor, backgroundColor: withAlpha(cor, 0.12) },
                  pressed && styles.pressionado,
                ]}>
                {opcao !== 'Todas' && (
                  <SymbolView
                    name={VISUAL[opcao].icone}
                    size={14}
                    tintColor={ativo ? cor : TextColor.secondary}
                  />
                )}
                <Text style={[styles.chipTexto, ativo && { color: cor }]}>{opcao}</Text>
                <Text style={styles.chipNumero}>{n}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.lista}>
          {lista.slice(0, visiveis).map((item, index) => {
            const v = VISUAL[item.categoria];
            const atual = item.id === destaque.id;
            return (
              <Animated.View
                key={item.id}
                entering={
                  reduzirMovimento
                    ? undefined
                    : FadeInDown.duration(220).delay((index % POR_VEZ) * 30)
                }>
                <Pressable
                  onPress={() => colocarEmDestaque(item)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: atual }}
                  accessibilityHint="Coloca esta curiosidade em destaque"
                  style={({ pressed }) => [
                    styles.cartao,
                    atual && { borderColor: withAlpha(v.cor, 0.6) },
                    pressed && styles.pressionado,
                  ]}>
                  <View style={[styles.iconeFundo, { backgroundColor: withAlpha(v.cor, 0.15) }]}>
                    <SymbolView name={v.icone} size={18} tintColor={v.cor} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={[styles.categoria, { color: v.cor }]}>{item.categoria}</Text>
                    <Text style={styles.cartaoTexto} numberOfLines={3}>
                      {item.texto}
                    </Text>
                  </View>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>

        {restantes > 0 ? (
          <Pressable
            onPress={() => setVisiveis((n) => n + POR_VEZ)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.mais, pressed && styles.pressionado]}>
            <Text style={styles.maisTexto}>
              Mostrar mais {Math.min(POR_VEZ, restantes)} de {restantes}
            </Text>
          </Pressable>
        ) : (
          <Text style={styles.rodape}>
            {lista.length > POR_VEZ ? 'Você viu todas desta lista. ' : ''}
            Toque em uma curiosidade para colocá-la em destaque.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: Ink.ink900 },
  conteudo: { padding: ScreenInset, paddingBottom: Space.twelve },
  flex: { flex: 1 },
  pressionado: { opacity: 0.75 },

  cabecalho: { alignItems: 'center', marginTop: Space.four, gap: Space.two },
  cabecalhoIcone: {
    width: 64,
    height: 64,
    borderRadius: Radius.pill,
    backgroundColor: withAlpha(Accent.amber, 0.14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: {
    marginTop: Space.two,
    fontFamily: DSFonts.display,
    fontSize: 30,
    lineHeight: 36,
    color: TextColor.primary,
  },
  subtitulo: {
    fontFamily: DSFonts.ui,
    fontSize: 15,
    lineHeight: 22,
    color: TextColor.secondary,
    textAlign: 'center',
  },

  destaque: {
    marginTop: Space.six,
    padding: Space.six,
    gap: Space.four,
    borderRadius: Radius.sheet,
    borderWidth: 1,
    backgroundColor: Ink.ink700,
  },
  selo: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.two,
    paddingHorizontal: Space.three,
    paddingVertical: Space.one,
    borderRadius: Radius.pill,
  },
  seloTexto: { fontFamily: DSFonts.ui, fontSize: 12, fontWeight: '700' },
  destaqueTexto: {
    fontFamily: DSFonts.display,
    fontSize: 20,
    lineHeight: 30,
    color: TextColor.primary,
  },
  botao: {
    alignSelf: 'flex-start',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.two,
    paddingHorizontal: Space.four,
    borderRadius: Radius.pill,
    backgroundColor: Mint.mint400,
  },
  botaoTexto: { fontFamily: DSFonts.ui, fontSize: 14, fontWeight: '700', color: Ink.ink900 },

  chipsLista: { marginTop: Space.six, marginHorizontal: -ScreenInset, flexGrow: 0 },
  chips: { paddingHorizontal: ScreenInset, gap: Space.two },
  chip: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.two,
    paddingHorizontal: Space.four,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Ink.ink500,
  },
  chipTexto: {
    fontFamily: DSFonts.ui,
    fontSize: 13,
    fontWeight: '700',
    color: TextColor.secondary,
  },
  chipNumero: {
    fontFamily: DSFonts.ui,
    fontSize: 12,
    fontWeight: '600',
    color: TextColor.secondary,
  },

  lista: { marginTop: Space.four, gap: Space.three },
  cartao: {
    flexDirection: 'row',
    gap: Space.three,
    padding: Space.four,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Ink.ink600,
    backgroundColor: Ink.ink800,
  },
  iconeFundo: {
    width: 36,
    height: 36,
    borderRadius: Radius.cover,
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
    color: TextColor.primary,
  },

  mais: {
    marginTop: Space.four,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: withAlpha(Mint.mint400, 0.5),
  },
  maisTexto: { fontFamily: DSFonts.ui, fontSize: 14, fontWeight: '700', color: Mint.mint400 },
  rodape: {
    marginTop: Space.six,
    fontFamily: DSFonts.ui,
    fontSize: 13,
    lineHeight: 19,
    color: TextColor.secondary,
    textAlign: 'center',
  },
});
