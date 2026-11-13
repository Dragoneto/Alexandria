import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';

import {
  DSFonts,
  Ink,
  Mint,
  Radius,
  ScreenInset,
  Shadow,
  Space,
  TextColor,
} from '@/constants/design-system';
import { ErrorState } from '@/components/error-state';
import { FeedbackPressable } from '@/components/feedback-pressable';
import { SkeletonBookShelf } from '@/components/skeletons';
import {
  CATEGORIAS,
  embaralhar,
  sortearDestaque,
  sortearEstantes,
  type Categoria,
} from '@/constants/estantes';
import { useFoco } from '@/hooks/use-foco';
import { useLoadingGate } from '@/hooks/use-loading-gate';
import { getProfile, getProfilePhoto } from '@/services/auth';
import { searchBooks, type BookSearchItem } from '@/services/open-library';

// Muda a cada toque que abre o Explorar, para a mesma busca repetida ser refeita lá.
let toques = 0;
const proximoToque = () => ++toques;

const COVER_WIDTH = 112;
const COVER_HEIGHT = 168; // proporção 2:3, a de uma capa de verdade

function novoSorteio(id = 0) {
  return {
    id,
    estantes: sortearEstantes(),
    categorias: embaralhar(CATEGORIAS),
    destaque: sortearDestaque(),
  };
}

function saudacao() {
  const hora = new Date().getHours();
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

function dataDeHoje() {
  return new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export default function HomeScreen() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const { focado: buscaFocada, propsDeFoco } = useFoco();
  const [firstName, setFirstName] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  // Cada sorteio monta outra combinação de destaque, categorias e estantes.
  // Muda toda vez que a home abre e quando a pessoa puxa a tela para baixo.
  const [{ id: sorteio, estantes, categorias, destaque }, setSorteio] = useState(novoSorteio);
  const [refreshing, setRefreshing] = useState(false);

  const sortearDeNovo = useCallback(() => {
    setRefreshing(true);
    setSorteio((atual) => novoSorteio(atual.id + 1));
    // As estantes mostram o próprio carregamento; o indicador do pull-to-refresh só confirma o gesto
    setTimeout(() => setRefreshing(false), 400);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([getProfile(), getProfilePhoto().catch(() => null)])
        .then(([profile, savedPhoto]) => {
          if (!active) return;
          setFirstName(profile?.name?.trim().split(' ')[0] ?? '');
          setPhoto(savedPhoto);
        })
        .catch(() => {
          // A home continua utilizável sem os dados do perfil.
        });
      return () => {
        active = false;
      };
    }, []),
  );

  // Só a categoria vai para o Explorar: a caixa de busca chega vazia e o "t" força uma nova busca.
  const abrirCategoria = (categoria: Categoria) => {
    router.push(`/explore?categoria=${encodeURIComponent(categoria)}&t=${proximoToque()}` as Href);
  };

  const handleSearch = () => {
    const normalized = searchTerm.trim();
    if (!normalized) return;
    router.push(`/explore?q=${encodeURIComponent(normalized)}&t=${proximoToque()}` as Href);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={sortearDeNovo}
            tintColor={Mint.mint400}
            colors={[Mint.mint400]}
            progressBackgroundColor={Ink.ink700}
          />
        }>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.date}>{dataDeHoje()}</Text>
            <Text style={styles.greeting} numberOfLines={1}>
              {firstName ? `${saudacao()}, ${firstName}` : saudacao()}
            </Text>
          </View>

          <Pressable
            onPress={() => router.push('/perfil')}
            accessibilityRole="button"
            accessibilityLabel="Abrir meu perfil"
            hitSlop={Space.two}
            style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.avatarImage} contentFit="cover" />
            ) : (
              <Text style={styles.avatarLabel}>{(firstName || '?').charAt(0).toUpperCase()}</Text>
            )}
          </Pressable>
        </View>

        <View style={[styles.search, buscaFocada && styles.searchFocada]}>
          <SymbolView
            name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
            size={18}
            tintColor={TextColor.secondary}
          />
          <TextInput
            {...propsDeFoco}
            style={styles.searchInput}
            accessibilityLabel="Buscar livros ou autores"
            placeholder="Buscar livros ou autores"
            placeholderTextColor={TextColor.muted}
            value={searchTerm}
            onChangeText={setSearchTerm}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            selectionColor={Mint.mint400}
          />
        </View>

        <Destaque key={`destaque-${sorteio}`} {...destaque} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Explore por categoria</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}>
            {categorias.map((categoria) => (
              <FeedbackPressable
                key={categoria}
                accessibilityRole="button"
                accessibilityLabel={`Explorar livros de ${categoria}`}
                onPress={() => abrirCategoria(categoria)}
                style={styles.chip}>
                <Text style={styles.chipText}>{categoria}</Text>
              </FeedbackPressable>
            ))}
          </ScrollView>
        </View>

        {estantes.map(({ key, ...estante }) => (
          <Estante key={`${sorteio}-${key}`} {...estante} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

type EstanteProps = {
  title: string;
  query: string;
  category?: string;
  page?: number;
};

/** Abaixo disso a estante parece vazia; completa com a primeira página. */
const MINIMO_POR_ESTANTE = 6;

/**
 * Busca uma página sorteada e embaralha o resultado. Se a página sorteada vier
 * fraca (comum em autores brasileiros nas páginas 2 e 3), completa com a
 * primeira, que é a que mais tem obras com capa e autor.
 */
async function buscarSorteado(
  { query, category, page = 1 }: Omit<EstanteProps, 'title'>,
  signal: AbortSignal,
): Promise<BookSearchItem[]> {
  const buscar = async (pagina: number) =>
    (await searchBooks({ query, category, quality: 'curated', page: pagina, limit: 12, signal }))
      .books;
  let books = await buscar(page);
  if (books.length < MINIMO_POR_ESTANTE && page > 1) {
    const vistos = new Set(books.map((book) => book.id));
    books = [...books, ...(await buscar(1)).filter((book) => !vistos.has(book.id))];
  }
  return embaralhar(books);
}

/** Um livro sorteado em destaque no topo da home. */
function Destaque({ query, category, page }: Omit<EstanteProps, 'title'>) {
  const router = useRouter();
  const [book, setBook] = useState<BookSearchItem | null>(null);
  const [state, setState] = useState<'loading' | 'success' | 'hidden'>('loading');

  useEffect(() => {
    const controller = new AbortController();
    buscarSorteado({ query, category, page }, controller.signal)
      .then((books) => {
        if (controller.signal.aborted) return;
        setBook(books[0] ?? null);
        setState(books.length ? 'success' : 'hidden');
      })
      .catch(() => {
        // Sem destaque a home continua completa: o bloco só some.
        if (!controller.signal.aborted) setState('hidden');
      });
    return () => controller.abort();
  }, [query, category, page]);

  if (state === 'hidden') return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Sugestão para você</Text>
      <Pressable
        disabled={!book}
        accessibilityRole="button"
        accessibilityLabel={
          book
            ? `Livro sugerido: ${book.title}, de ${book.authors[0] ?? 'autor desconhecido'}`
            : undefined
        }
        onPress={() => book && router.push({ pathname: '/livro/[id]', params: { id: book.id } })}
        style={({ pressed }) => [styles.featured, pressed && styles.pressed]}>
        <View style={[styles.featuredCover, !book && styles.featuredPlaceholder]}>
          {book ? (
            <Image
              source={{ uri: book.coverUrl ?? undefined }}
              style={styles.featuredCoverImage}
              contentFit="cover"
              transition={200}
            />
          ) : null}
        </View>
        <View style={styles.featuredText}>
          {book ? (
            <>
              {category ? <Text style={styles.featuredTag}>{category}</Text> : null}
              <Text style={styles.featuredTitle} numberOfLines={3}>
                {book.title}
              </Text>
              <Text style={styles.featuredAuthor} numberOfLines={1}>
                {book.authors[0]}
              </Text>
              <Text style={styles.featuredAction}>Ver livro</Text>
            </>
          ) : (
            <Text style={styles.featuredAuthor}>Escolhendo um livro…</Text>
          )}
        </View>
      </Pressable>
    </View>
  );
}

/** Estante horizontal de capas com vazio, erro e carregamento explícitos. */
function Estante({ title, query, category, page = 1 }: EstanteProps) {
  const router = useRouter();
  const [books, setBooks] = useState<BookSearchItem[]>([]);
  const [state, setState] = useState<'loading' | 'success' | 'empty' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const loadingVisible = useLoadingGate(state === 'loading');

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setState('loading');
      try {
        const result = await buscarSorteado({ query, category, page }, controller.signal);
        if (controller.signal.aborted) return;
        setBooks(result);
        setState(result.length ? 'success' : 'empty');
      } catch {
        if (!controller.signal.aborted) setState('error');
      }
    };
    void load();
    return () => controller.abort();
  }, [query, category, page, attempt]);

  return (
    <View style={styles.shelf}>
      <Text style={styles.shelfTitle}>{title}</Text>

      {state === 'loading' ? (
        loadingVisible ? (
          <SkeletonBookShelf />
        ) : null
      ) : state === 'error' ? (
        <ErrorState
          title="Esta estante não carregou"
          message="Tente novamente para ver os livros desta seleção."
          onRetry={() => setAttempt((current) => current + 1)}
        />
      ) : state === 'empty' ? (
        <View style={styles.shelfEmpty}>
          <Text style={styles.shelfEmptyText}>Nenhum livro apareceu nesta estante.</Text>
          <FeedbackPressable
            accessibilityRole="button"
            accessibilityLabel={`Buscar livros em ${title}`}
            onPress={() =>
              router.push(`/explore?q=${encodeURIComponent(query)}&t=${proximoToque()}` as Href)
            }
            style={styles.shelfAction}>
            <Text style={styles.shelfActionText}>Buscar livros</Text>
          </FeedbackPressable>
        </View>
      ) : (
        <FlatList
          horizontal
          data={books}
          keyExtractor={(book) => book.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.shelfRow}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.title}, de ${item.authors[0] ?? 'autor desconhecido'}`}
              onPress={() => router.push({ pathname: '/livro/[id]', params: { id: item.id } })}
              style={({ pressed }) => [styles.book, pressed && styles.pressed]}>
              <View style={styles.coverFrame}>
                <Image
                  source={{ uri: item.coverUrl ?? undefined }}
                  style={styles.cover}
                  contentFit="cover"
                  transition={200}
                />
              </View>
              <Text style={styles.bookTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.bookAuthor} numberOfLines={1}>
                {item.authors[0]}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Ink.ink900,
  },
  content: {
    paddingTop: Space.four,
    paddingBottom: Space.twelve,
  },
  pressed: {
    opacity: 0.7,
  },

  // Cabeçalho
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.four,
    paddingHorizontal: ScreenInset,
  },
  headerText: {
    flex: 1,
    gap: Space.one,
  },
  date: {
    fontFamily: DSFonts.ui,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.76,
    textTransform: 'uppercase',
    color: TextColor.secondary,
  },
  greeting: {
    fontFamily: DSFonts.display,
    fontSize: 28,
    lineHeight: 34,
    color: TextColor.primary,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    backgroundColor: Ink.ink600,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarLabel: {
    fontFamily: DSFonts.display,
    fontSize: 18,
    color: TextColor.primary,
  },

  // Busca
  search: {
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
  searchFocada: {
    borderColor: Mint.mint400,
  },
  searchInput: {
    flex: 1,
    // O campo ocupa a altura toda da pílula: tocar em qualquer ponto dela já abre o teclado.
    alignSelf: 'stretch',
    fontFamily: DSFonts.ui,
    fontSize: 16,
    color: TextColor.primary,
  },

  // Seções novas: destaque, categorias e cabeçalho das estantes
  section: {
    marginTop: Space.eight,
    gap: Space.three,
  },
  sectionTitle: {
    paddingHorizontal: ScreenInset,
    fontFamily: DSFonts.display,
    fontSize: 20,
    lineHeight: 26,
    color: TextColor.primary,
  },
  featured: {
    flexDirection: 'row',
    gap: Space.four,
    marginHorizontal: ScreenInset,
    padding: Space.four,
    borderRadius: Radius.card,
    backgroundColor: Ink.ink700,
  },
  featuredCover: {
    width: 96,
    height: 144,
    borderRadius: Radius.cover,
    backgroundColor: Ink.ink600,
    overflow: 'hidden',
    ...Shadow.e1,
  },
  featuredPlaceholder: {
    opacity: 0.6,
  },
  featuredCoverImage: {
    width: '100%',
    height: '100%',
  },
  featuredText: {
    flex: 1,
    justifyContent: 'center',
    gap: Space.one,
  },
  featuredTag: {
    fontFamily: DSFonts.ui,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: Mint.mint400,
  },
  featuredTitle: {
    fontFamily: DSFonts.display,
    fontSize: 20,
    lineHeight: 26,
    color: TextColor.primary,
  },
  featuredAuthor: {
    fontFamily: DSFonts.ui,
    fontSize: 14,
    color: TextColor.secondary,
  },
  featuredAction: {
    marginTop: Space.two,
    fontFamily: DSFonts.ui,
    fontSize: 14,
    fontWeight: '700',
    color: Mint.mint400,
  },
  chipsRow: {
    paddingHorizontal: ScreenInset,
    gap: Space.two,
  },
  chip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: Space.four,
    borderRadius: Radius.pill,
    backgroundColor: Ink.ink700,
    borderWidth: 1,
    borderColor: Ink.ink600,
  },
  chipText: {
    fontFamily: DSFonts.ui,
    fontSize: 14,
    fontWeight: '600',
    color: TextColor.primary,
  },

  // Estantes
  shelf: {
    marginTop: Space.eight,
    gap: Space.three,
  },
  shelfTitle: {
    paddingHorizontal: ScreenInset,
    fontFamily: DSFonts.display,
    fontSize: 20,
    lineHeight: 26,
    color: TextColor.primary,
  },
  shelfRow: {
    paddingHorizontal: ScreenInset,
    gap: Space.four,
  },
  shelfEmpty: { paddingHorizontal: ScreenInset, gap: Space.two },
  shelfEmptyText: { fontFamily: DSFonts.ui, fontSize: 14, color: TextColor.secondary },
  shelfAction: {
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: Space.two,
  },
  shelfActionText: { fontFamily: DSFonts.ui, fontSize: 14, fontWeight: '700', color: Mint.mint400 },
  book: {
    width: COVER_WIDTH,
    gap: Space.one,
  },
  coverFrame: {
    marginBottom: Space.one,
    borderRadius: Radius.cover,
    backgroundColor: Ink.ink700,
    ...Shadow.e1,
  },
  cover: {
    width: COVER_WIDTH,
    height: COVER_HEIGHT,
    borderRadius: Radius.cover,
  },
  bookTitle: {
    fontFamily: DSFonts.display,
    fontSize: 14,
    lineHeight: 18,
    color: TextColor.primary,
  },
  bookAuthor: {
    fontFamily: DSFonts.ui,
    fontSize: 12,
    lineHeight: 16,
    color: TextColor.secondary,
  },
});
