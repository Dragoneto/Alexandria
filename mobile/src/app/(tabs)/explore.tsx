import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TextInput,
  type TextInputInstance,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookCard } from '@/components/book-card';
import { EmptyState } from '@/components/empty_state';
import { ErrorState } from '@/components/error-state';
import { FeedbackPressable } from '@/components/feedback-pressable';
import { SkeletonGrid } from '@/components/skeletons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DisabledOpacity, Mint, withAlpha } from '@/constants/design-system';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { CATEGORIAS, termoDaCategoria, type Categoria } from '@/constants/estantes';
import { useFoco } from '@/hooks/use-foco';
import { useLoadingGate } from '@/hooks/use-loading-gate';
import { useTheme } from '@/hooks/use-theme';
import {
  describeSearchError,
  OpenLibraryError,
  searchBooks,
  type BookSearchItem,
  type BookSearchOrder,
  type BookSearchQuality,
  type SearchErrorView,
} from '@/services/open-library';

const CATEGORY_OPTIONS: string[] = ['Todos', ...CATEGORIAS];

function ehCategoria(valor: string): valor is Categoria {
  return (CATEGORIAS as readonly string[]).includes(valor);
}
const ORDER_OPTIONS: { label: string; value: BookSearchOrder }[] = [
  { label: 'Mais relevantes', value: 'relevance' },
  { label: 'Mais recentes', value: 'newest' },
];
const QUALITY_OPTIONS: { label: string; value: BookSearchQuality; detail: string }[] = [
  { label: 'Precisos', value: 'precise', detail: 'Título, autor ou assunto' },
  { label: 'Com capa', value: 'curated', detail: 'Capa e autoria disponíveis' },
  { label: 'Amplos', value: 'all', detail: 'Todos os resultados válidos' },
];
const LOAD_MORE_THRESHOLD = 600;
const MAX_EMPTY_PAGES = 3;

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export default function Explorar() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{
    q?: string | string[];
    categoria?: string | string[];
    t?: string | string[];
  }>();
  const paramCategory = firstParam(params.categoria).trim();
  const initialCategory = ehCategoria(paramCategory) ? paramCategory : '';
  // Vindo de uma categoria da home, o termo da busca fica por trás e a caixa fica livre.
  const initialQuery = initialCategory ? '' : firstParam(params.q).trim();
  const paramCategoryKey = initialCategory ? `${initialCategory}|${firstParam(params.t)}` : '';
  // O "t" muda a cada toque na home, então repetir a mesma busca de lá também atualiza aqui.
  const paramQueryKey = initialQuery ? `${initialQuery}|${firstParam(params.t)}` : '';
  const [query, setQuery] = useState(initialQuery);
  const { focado: buscaFocada, propsDeFoco } = useFoco();
  const [submittedQuery, setSubmittedQuery] = useState(() =>
    initialCategory ? termoDaCategoria(initialCategory) : initialQuery,
  );
  const [category, setCategory] = useState(initialCategory || 'Todos');
  // true quando os resultados vêm só da categoria, sem nada digitado na caixa.
  const [buscaDaCategoria, setBuscaDaCategoria] = useState(!!initialCategory);
  const [order, setOrder] = useState<BookSearchOrder>('relevance');
  const [quality, setQuality] = useState<BookSearchQuality>('precise');
  // Ordenação e qualidade ficam recolhidas para os resultados aparecerem logo no celular.
  const [maisFiltros, setMaisFiltros] = useState(false);
  const [books, setBooks] = useState<BookSearchItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const showSearchSkeleton = useLoadingGate(loading);
  const showMoreSkeleton = useLoadingGate(loadingMore);
  const [error, setError] = useState('');
  const [searchFailure, setSearchFailure] = useState<SearchErrorView | null>(null);
  const [loadMoreError, setLoadMoreError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const inputRef = useRef<TextInputInstance>(null);
  const loadMoreControllerRef = useRef<AbortController | null>(null);
  const scrollMetricsRef = useRef({ offset: 0, viewport: 0, content: 0 });
  const activeSearchKey = `${submittedQuery}\u0000${category}\u0000${order}\u0000${quality}`;
  const activeSearchKeyRef = useRef(activeSearchKey);
  const lastParamQueryRef = useRef(paramQueryKey);
  const lastParamCategoryRef = useRef(paramCategoryKey);

  const hasActiveFilters = category !== 'Todos' || order !== 'relevance' || quality !== 'precise';
  const qualityCaption = useMemo(() => {
    if (quality === 'curated') return 'Exibindo obras com capa e autoria informada.';
    if (quality === 'all') return 'Exibindo todos os resultados válidos da Open Library.';
    return 'Resultados ordenados para aproximar título, autor ou assunto.';
  }, [quality]);

  useEffect(() => {
    activeSearchKeyRef.current = activeSearchKey;
  }, [activeSearchKey]);

  useEffect(
    () => () => {
      loadMoreControllerRef.current?.abort();
    },
    [],
  );

  // As categorias da home abrem a busca já filtrada (?categoria=Fantasia)
  useEffect(() => {
    if (!initialCategory || paramCategoryKey === lastParamCategoryRef.current) return;
    lastParamCategoryRef.current = paramCategoryKey;
    void Promise.resolve().then(() => {
      setCategory(initialCategory);
      setQuery('');
      setError('');
      setSubmittedQuery(termoDaCategoria(initialCategory));
      setBuscaDaCategoria(true);
    });
  }, [initialCategory, paramCategoryKey]);

  useEffect(() => {
    if (!initialQuery || paramQueryKey === lastParamQueryRef.current) return;
    lastParamQueryRef.current = paramQueryKey;
    void Promise.resolve().then(() => {
      setQuery(initialQuery);
      setError('');
      setSubmittedQuery(initialQuery);
      setBuscaDaCategoria(false);
      setCategory('Todos');
    });
  }, [initialQuery, paramQueryKey]);

  useEffect(() => {
    if (!submittedQuery) return;
    const controller = new AbortController();
    loadMoreControllerRef.current?.abort();
    loadMoreControllerRef.current = null;
    const runSearch = async () => {
      // Inicia fora do corpo síncrono do effect e evita uma renderização encadeada.
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setLoading(true);
      setError('');
      setSearchFailure(null);
      setLoadMoreError('');
      try {
        const result = await searchBooks({
          query: submittedQuery,
          category: category === 'Todos' ? undefined : category,
          order,
          quality,
          page: 1,
          signal: controller.signal,
        });
        setBooks(result.books);
        setTotal(result.total);
        setPage(1);
        setHasMore(result.hasMore);
      } catch (failure) {
        if (!controller.signal.aborted) {
          setBooks([]);
          setTotal(0);
          setHasMore(false);
          // Termo inválido é erro do campo; rede, timeout e servidor viram o cartão
          if (failure instanceof OpenLibraryError && failure.kind === 'validation')
            setError(failure.message);
          else setSearchFailure(describeSearchError(failure));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void runSearch();
    return () => controller.abort();
  }, [submittedQuery, category, order, quality, refresh]);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setError('');
    // Apagar o que foi digitado não derruba os livros da categoria que já estão na tela.
    if (value.trim() || buscaDaCategoria) return;
    limparResultados();
  };

  const limparResultados = () => {
    loadMoreControllerRef.current?.abort();
    setBuscaDaCategoria(false);
    setSubmittedQuery('');
    setBooks([]);
    setTotal(0);
    setPage(1);
    setHasMore(false);
    setLoading(false);
    setLoadMoreError('');
  };

  const handleClearQuery = () => {
    handleQueryChange('');
    inputRef.current?.getNativeRef()?.focus();
  };

  const handleSearch = () => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      setError('Digite pelo menos dois caracteres para buscar.');
      inputRef.current?.getNativeRef()?.focus();
      return;
    }
    setError('');
    // Uma busca digitada substitui a da categoria que veio da home.
    if (buscaDaCategoria) {
      setBuscaDaCategoria(false);
      setCategory('Todos');
    }
    if (normalized === submittedQuery) setRefresh((value) => value + 1);
    else setSubmittedQuery(normalized);
  };

  const escolherCategoria = (opcao: string) => {
    setCategory(opcao);
    // Sem nada digitado, a categoria sozinha já mostra livros.
    if (!buscaDaCategoria && submittedQuery) return;
    if (ehCategoria(opcao)) {
      setSubmittedQuery(termoDaCategoria(opcao));
      setBuscaDaCategoria(true);
    } else if (buscaDaCategoria) {
      limparResultados();
    }
  };

  const loadMore = async () => {
    if (!submittedQuery || !hasMore || loadMoreControllerRef.current) return;
    const requestedSearchKey = activeSearchKey;
    const controller = new AbortController();
    loadMoreControllerRef.current = controller;
    setLoadingMore(true);
    setLoadMoreError('');
    try {
      const known = new Set(books.map((book) => book.id));
      const fresh: BookSearchItem[] = [];
      let nextPage = page + 1;
      let more = true;
      for (let attempt = 0; attempt < MAX_EMPTY_PAGES && more && !fresh.length; attempt += 1) {
        const result = await searchBooks({
          query: submittedQuery,
          category: category === 'Todos' ? undefined : category,
          order,
          quality,
          page: nextPage,
          signal: controller.signal,
        });
        if (requestedSearchKey !== activeSearchKeyRef.current) return;
        fresh.push(...result.books.filter((book) => !known.has(book.id)));
        more = result.hasMore;
        nextPage = result.page + 1;
      }
      setBooks((current) => {
        const ids = new Set(current.map((book) => book.id));
        return [...current, ...fresh.filter((book) => !ids.has(book.id))];
      });
      setPage(nextPage - 1);
      setHasMore(more);
    } catch (failure) {
      if (!controller.signal.aborted) setLoadMoreError(describeSearchError(failure).message);
    } finally {
      if (loadMoreControllerRef.current === controller) {
        loadMoreControllerRef.current = null;
        setLoadingMore(false);
      }
    }
  };

  const loadMoreIfNearEnd = () => {
    const { offset, viewport, content } = scrollMetricsRef.current;
    const nearEnd = viewport > 0 && offset + viewport >= content - LOAD_MORE_THRESHOLD;
    if (nearEnd && hasMore && !loading && !loadMoreError) void loadMore();
  };

  const clearFilters = () => {
    if (buscaDaCategoria) limparResultados();
    setCategory('Todos');
    setOrder('relevance');
    setQuality('precise');
  };

  const openBook = (book: BookSearchItem) => {
    router.push({ pathname: '/livro/[id]', params: { id: book.id } });
  };

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={100}
          onScroll={({ nativeEvent }) => {
            scrollMetricsRef.current = {
              offset: nativeEvent.contentOffset.y,
              viewport: nativeEvent.layoutMeasurement.height,
              content: nativeEvent.contentSize.height,
            };
            loadMoreIfNearEnd();
          }}
          onLayout={({ nativeEvent }) => {
            scrollMetricsRef.current.viewport = nativeEvent.layout.height;
            loadMoreIfNearEnd();
          }}
          onContentSizeChange={(_, height) => {
            scrollMetricsRef.current.content = height;
            loadMoreIfNearEnd();
          }}>
          <View style={styles.content}>
            <ThemedText themeColor="accent" style={styles.eyebrow}>
              Explorar
            </ThemedText>
            {/* Com uma busca feita, o título sai para os resultados subirem na tela. */}
            {!submittedQuery && (
              <>
                <ThemedText type="title" style={styles.title}>
                  Encontre sua próxima leitura.
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.subtitle}>
                  Pesquise o catálogo público da Open Library por título, autor ou assunto.
                </ThemedText>
              </>
            )}

            <View style={[styles.searchBox, { borderColor: theme.border }]}>
              <ThemedText themeColor="textSecondary" style={styles.searchLabel}>
                Buscar por título, autor ou assunto
              </ThemedText>
              <View style={styles.inputRow}>
                <View style={styles.inputContainer}>
                  <TextInput
                    {...propsDeFoco}
                    ref={inputRef}
                    accessibilityLabel="Busca de livros"
                    style={[
                      styles.input,
                      {
                        borderColor: buscaFocada ? theme.accent : theme.border,
                        color: theme.text,
                        paddingRight: query ? 40 : 14,
                      },
                    ]}
                    placeholder={
                      buscaDaCategoria ? 'Buscar outro título ou autor' : 'Ex.: Machado de Assis'
                    }
                    placeholderTextColor={theme.textMuted}
                    value={query}
                    onChangeText={handleQueryChange}
                    onSubmitEditing={handleSearch}
                    returnKeyType="search"
                  />
                  {!!query && (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Limpar busca"
                      onPress={handleClearQuery}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      style={styles.clearInputButton}>
                      <ThemedText themeColor="textSecondary" style={styles.clearInputIcon}>
                        ✕
                      </ThemedText>
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  disabled={loading}
                  onPress={handleSearch}
                  style={[
                    styles.searchButton,
                    { backgroundColor: theme.accent, opacity: loading ? DisabledOpacity : 1 },
                  ]}>
                  {loading ? (
                    <ActivityIndicator color={theme.background} />
                  ) : (
                    <ThemedText style={[styles.searchButtonText, { color: theme.background }]}>
                      Buscar
                    </ThemedText>
                  )}
                </TouchableOpacity>
              </View>
              {!!error && (
                <ThemedText themeColor="danger" style={styles.errorText}>
                  {error}
                </ThemedText>
              )}
            </View>

            <View style={styles.filterHeader}>
              <View>
                <ThemedText style={styles.filterHeaderTitle}>Filtros</ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.filterHeaderSubtitle}>
                  {hasActiveFilters ? 'Busca refinada' : 'Padrão'}
                </ThemedText>
              </View>
              <FeedbackPressable
                accessibilityRole="button"
                accessibilityLabel="Limpar filtros"
                disabled={!hasActiveFilters || loading}
                onPress={clearFilters}
                style={[
                  styles.clearButton,
                  {
                    borderColor: theme.border,
                    opacity: hasActiveFilters && !loading ? 1 : DisabledOpacity,
                  },
                ]}>
                <ThemedText themeColor="accent" style={styles.clearButtonText}>
                  Limpar
                </ThemedText>
              </FeedbackPressable>
            </View>

            <ThemedText themeColor="textSecondary" style={styles.filterBlockLabel}>
              Categorias
            </ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipsScroll}>
              {CATEGORY_OPTIONS.map((option) => {
                const active = category === option;
                return (
                  <FeedbackPressable
                    accessibilityRole="radio"
                    accessibilityLabel={`Categoria ${option}`}
                    accessibilityState={{ checked: active, disabled: loading }}
                    key={option}
                    disabled={loading}
                    onPress={() => escolherCategoria(option)}
                    style={[
                      styles.chip,
                      { borderColor: active ? theme.accent : theme.border },
                      loading && { opacity: DisabledOpacity },
                    ]}>
                    <ThemedText
                      themeColor={active ? 'accent' : 'textSecondary'}
                      style={styles.chipText}>
                      {option}
                    </ThemedText>
                  </FeedbackPressable>
                );
              })}
            </ScrollView>

            <FeedbackPressable
              accessibilityRole="button"
              accessibilityLabel={
                maisFiltros ? 'Esconder ordenação e qualidade' : 'Mostrar ordenação e qualidade'
              }
              accessibilityState={{ expanded: maisFiltros }}
              onPress={() => setMaisFiltros((aberto) => !aberto)}
              style={styles.maisFiltros}>
              <ThemedText themeColor="accent" style={styles.clearButtonText}>
                {maisFiltros ? 'Menos filtros' : 'Mais filtros'}
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.maisFiltrosResumo}>
                {`${ORDER_OPTIONS.find((o) => o.value === order)?.label} · ${QUALITY_OPTIONS.find((o) => o.value === quality)?.label}`}
              </ThemedText>
            </FeedbackPressable>

            {maisFiltros && (
              <>
                <ThemedText themeColor="textSecondary" style={styles.filterBlockLabel}>
                  Ordenação
                </ThemedText>
                <View style={[styles.segmented, { borderColor: theme.border }]}>
                  {ORDER_OPTIONS.map((option) => {
                    const active = order === option.value;
                    return (
                      <FeedbackPressable
                        accessibilityRole="radio"
                        accessibilityLabel={`Ordenar por ${option.label}`}
                        accessibilityState={{ checked: active, disabled: loading }}
                        key={option.value}
                        disabled={loading}
                        onPress={() => setOrder(option.value)}
                        style={[
                          styles.segment,
                          active && { backgroundColor: withAlpha(Mint.mint400, 0.1) },
                          loading && { opacity: DisabledOpacity },
                        ]}>
                        <ThemedText
                          themeColor={active ? 'accent' : 'textSecondary'}
                          style={styles.segmentText}>
                          {option.label}
                        </ThemedText>
                      </FeedbackPressable>
                    );
                  })}
                </View>

                <ThemedText themeColor="textSecondary" style={styles.filterBlockLabel}>
                  Qualidade
                </ThemedText>
                <View style={styles.qualityList}>
                  {QUALITY_OPTIONS.map((option) => {
                    const active = quality === option.value;
                    return (
                      <FeedbackPressable
                        accessibilityRole="radio"
                        accessibilityLabel={`Qualidade: ${option.label}`}
                        accessibilityState={{ checked: active, disabled: loading }}
                        key={option.value}
                        disabled={loading}
                        onPress={() => setQuality(option.value)}
                        style={[
                          styles.qualityCard,
                          { borderColor: active ? theme.accent : theme.border },
                          loading && { opacity: DisabledOpacity },
                        ]}>
                        <ThemedText
                          themeColor={active ? 'accent' : 'textSecondary'}
                          style={styles.qualityLabel}>
                          {option.label}
                        </ThemedText>
                        <ThemedText themeColor="textSecondary" style={styles.qualityDetail}>
                          {option.detail}
                        </ThemedText>
                      </FeedbackPressable>
                    );
                  })}
                </View>
              </>
            )}

            {!submittedQuery ? (
              <EmptyState
                title="Comece por uma busca"
                message="Pesquise por título, autor ou assunto para encontrar livros."
                primaryAction={{
                  label: 'Buscar livros',
                  onPress: () => inputRef.current?.getNativeRef()?.focus(),
                }}
              />
            ) : searchFailure ? (
              <ErrorState
                title={searchFailure.title}
                message={searchFailure.message}
                onRetry={() => setRefresh((value) => value + 1)}
              />
            ) : loading ? (
              showSearchSkeleton ? (
                <SkeletonGrid count={4} />
              ) : null
            ) : !loading && !error && books.length === 0 ? (
              <EmptyState
                title="Nenhum livro encontrado"
                message={
                  buscaDaCategoria
                    ? `Não encontramos livros de ${category} agora; tente outra categoria ou uma busca.`
                    : `Não encontramos “${submittedQuery}”; tente outro título, autor ou assunto.`
                }
                primaryAction={{
                  label: 'Fazer nova busca',
                  onPress: () => {
                    setQuery('');
                    limparResultados();
                    inputRef.current?.getNativeRef()?.focus();
                  },
                }}
                secondaryAction={
                  hasActiveFilters ? { label: 'Limpar filtros', onPress: clearFilters } : undefined
                }
              />
            ) : (
              <>
                <View style={styles.resultsHeader}>
                  <ThemedText style={styles.resultsTitle}>
                    {buscaDaCategoria
                      ? `Livros de ${category}`
                      : `Resultados para “${submittedQuery}”`}
                  </ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.resultsCaption}>
                    {qualityCaption}
                  </ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.resultsCount}>
                    {total.toLocaleString('pt-BR')} obra(s) encontrada(s)
                  </ThemedText>
                </View>

                <View style={styles.grid}>
                  {books.map((book) => (
                    <BookCard key={book.id} book={book} onPress={openBook} />
                  ))}
                </View>

                {loadingMore ? (
                  showMoreSkeleton ? (
                    <SkeletonGrid count={2} />
                  ) : null
                ) : loadMoreError ? (
                  <ErrorState
                    title="Não foi possível carregar mais livros"
                    message={loadMoreError}
                    onRetry={() => void loadMore()}
                  />
                ) : !hasMore && !loading && books.length > 0 ? (
                  <ThemedText themeColor="textSecondary" style={styles.endText}>
                    Você chegou ao fim dos resultados.
                  </ThemedText>
                ) : null}
              </>
            )}

            <ThemedText themeColor="textSecondary" style={styles.attribution}>
              Dados bibliográficos e capas fornecidos pela Open Library.
            </ThemedText>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  scrollContent: { flexGrow: 1, alignItems: 'center' },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.six,
  },
  eyebrow: {
    marginTop: Spacing.four,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: { marginTop: Spacing.one, fontSize: 30, lineHeight: 34 },
  subtitle: { marginTop: Spacing.two, lineHeight: 22 },
  searchBox: {
    marginTop: Spacing.four,
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  searchLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  inputRow: { gap: Spacing.two },
  inputContainer: { position: 'relative', justifyContent: 'center' },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  clearInputButton: {
    position: 'absolute',
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearInputIcon: {
    fontSize: 14,
    fontWeight: '700',
  },
  searchButton: { minHeight: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  searchButtonText: { fontWeight: '800', fontSize: 14 },
  errorText: { fontSize: 13, lineHeight: 20 },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.four,
  },
  filterHeaderTitle: { fontSize: 15, fontWeight: '800' },
  filterHeaderSubtitle: { fontSize: 12, marginTop: 2 },
  clearButton: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  clearButtonText: { fontSize: 12, fontWeight: '800' },
  filterBlockLabel: {
    marginTop: Spacing.three,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipsScroll: { marginTop: Spacing.two },
  maisFiltros: {
    marginTop: Spacing.two,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  maisFiltrosResumo: { fontSize: 12 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginRight: Spacing.two,
  },
  chipText: { fontSize: 13, fontWeight: '700' },
  segmented: {
    flexDirection: 'row',
    marginTop: Spacing.two,
    borderWidth: 1,
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  segment: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  segmentText: { fontSize: 12, fontWeight: '800' },
  qualityList: { marginTop: Spacing.two, gap: Spacing.two },
  qualityCard: { borderWidth: 1, borderRadius: 14, padding: Spacing.three, gap: 2 },
  qualityLabel: { fontSize: 14, fontWeight: '800' },
  qualityDetail: { fontSize: 12 },
  emptyCard: { marginTop: Spacing.five, borderRadius: 16, padding: Spacing.four, gap: 8 },
  emptyTitle: { fontSize: 18 },
  resultsHeader: { marginTop: Spacing.five, gap: 4 },
  resultsTitle: { fontSize: 17, fontWeight: '800' },
  resultsCaption: { fontSize: 13, lineHeight: 19 },
  resultsCount: { fontSize: 12, marginTop: 4 },
  grid: { marginTop: Spacing.three, gap: Spacing.three },
  listFooter: { marginTop: Spacing.four, gap: Spacing.two },
  footerError: { fontSize: 13, lineHeight: 20, textAlign: 'center' },
  endText: { marginTop: Spacing.four, fontSize: 13, textAlign: 'center' },
  attribution: { marginTop: Spacing.four, fontSize: 11, lineHeight: 17, textAlign: 'center' },
});
