import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  OpenLibraryError,
  searchBooks,
  type BookSearchItem,
  type BookSearchOrder,
  type BookSearchQuality,
} from '@/services/open-library';

const CATEGORY_OPTIONS = [
  'Todos',
  'Fantasia',
  'Romance',
  'História',
  'Tecnologia',
  'Biografia',
  'Mistério',
];
const ORDER_OPTIONS: { label: string; value: BookSearchOrder }[] = [
  { label: 'Mais relevantes', value: 'relevance' },
  { label: 'Mais recentes', value: 'newest' },
];
const QUALITY_OPTIONS: { label: string; value: BookSearchQuality; detail: string }[] = [
  { label: 'Precisos', value: 'precise', detail: 'Título, autor ou assunto' },
  { label: 'Com capa', value: 'curated', detail: 'Capa e autoria disponíveis' },
  { label: 'Amplos', value: 'all', detail: 'Todos os resultados válidos' },
];

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function errorMessage(error: unknown): string {
  if (error instanceof OpenLibraryError) return error.message;
  return 'Não foi possível buscar livros agora.';
}

export default function Explorar() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ q?: string | string[] }>();
  const initialQuery = firstParam(params.q).trim();
  const [query, setQuery] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery);
  const [category, setCategory] = useState('Todos');
  const [order, setOrder] = useState<BookSearchOrder>('relevance');
  const [quality, setQuality] = useState<BookSearchQuality>('precise');
  const [books, setBooks] = useState<BookSearchItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const inputRef = useRef<TextInput>(null);
  const loadMoreControllerRef = useRef<AbortController | null>(null);
  const activeSearchKey = `${submittedQuery}\u0000${category}\u0000${order}\u0000${quality}`;
  const activeSearchKeyRef = useRef(activeSearchKey);
  const lastParamQueryRef = useRef(initialQuery);

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

  useEffect(() => {
    if (!initialQuery || initialQuery === lastParamQueryRef.current) return;
    lastParamQueryRef.current = initialQuery;
    void Promise.resolve().then(() => {
      setQuery(initialQuery);
      setSubmittedQuery(initialQuery);
    });
  }, [initialQuery]);

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
          setError(errorMessage(failure));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void runSearch();
    return () => controller.abort();
  }, [submittedQuery, category, order, quality, refresh]);

  const handleSearch = () => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      setError('Digite pelo menos dois caracteres para buscar.');
      inputRef.current?.focus();
      return;
    }
    setError('');
    if (normalized === submittedQuery) setRefresh((value) => value + 1);
    else setSubmittedQuery(normalized);
  };

  const loadMore = async () => {
    if (!submittedQuery || loadingMore || !hasMore) return;
    const requestedSearchKey = activeSearchKey;
    const controller = new AbortController();
    loadMoreControllerRef.current?.abort();
    loadMoreControllerRef.current = controller;
    setLoadingMore(true);
    setError('');
    try {
      const result = await searchBooks({
        query: submittedQuery,
        category: category === 'Todos' ? undefined : category,
        order,
        quality,
        page: page + 1,
        signal: controller.signal,
      });
      if (requestedSearchKey !== activeSearchKeyRef.current) return;
      setBooks((current) => {
        const known = new Set(current.map((book) => book.id));
        return [...current, ...result.books.filter((book) => !known.has(book.id))];
      });
      setPage(result.page);
      setHasMore(result.hasMore);
    } catch (failure) {
      if (!controller.signal.aborted) setError(errorMessage(failure));
    } finally {
      if (loadMoreControllerRef.current === controller) {
        loadMoreControllerRef.current = null;
        setLoadingMore(false);
      }
    }
  };

  const clearFilters = () => {
    setCategory('Todos');
    setOrder('relevance');
    setQuality('precise');
  };

  const openBook = async (book: BookSearchItem) => {
    try {
      await Linking.openURL(book.openLibraryUrl);
    } catch {
      setError('Não foi possível abrir a página da obra.');
    }
  };

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <ThemedText themeColor="accent" style={styles.eyebrow}>
              Explorar
            </ThemedText>
            <ThemedText type="title" style={styles.title}>
              Encontre sua próxima leitura.
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              Pesquise o catálogo público da Open Library por título, autor ou assunto.
            </ThemedText>

            <View style={[styles.searchBox, { borderColor: theme.border }]}>
              <ThemedText themeColor="textMuted" style={styles.searchLabel}>
                Buscar por título, autor ou assunto
              </ThemedText>
              <View style={styles.inputRow}>
                <TextInput
                  ref={inputRef}
                  accessibilityLabel="Busca de livros"
                  style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                  placeholder="Ex.: Machado de Assis"
                  placeholderTextColor={theme.textMuted}
                  value={query}
                  onChangeText={(value) => {
                    setQuery(value);
                    setError('');
                  }}
                  onSubmitEditing={handleSearch}
                  returnKeyType="search"
                  editable={!loading}
                />
                <TouchableOpacity
                  accessibilityRole="button"
                  disabled={loading}
                  onPress={handleSearch}
                  style={[
                    styles.searchButton,
                    { backgroundColor: theme.accent, opacity: loading ? 0.65 : 1 },
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
                <ThemedText themeColor="textMuted" style={styles.filterHeaderSubtitle}>
                  {hasActiveFilters ? 'Busca refinada' : 'Padrão'}
                </ThemedText>
              </View>
              <TouchableOpacity
                disabled={!hasActiveFilters || loading}
                onPress={clearFilters}
                style={[
                  styles.clearButton,
                  { borderColor: theme.border, opacity: hasActiveFilters ? 1 : 0.4 },
                ]}>
                <ThemedText themeColor="accent" style={styles.clearButtonText}>
                  Limpar
                </ThemedText>
              </TouchableOpacity>
            </View>

            <ThemedText themeColor="textMuted" style={styles.filterBlockLabel}>
              Categorias
            </ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipsScroll}>
              {CATEGORY_OPTIONS.map((option) => {
                const active = category === option;
                return (
                  <TouchableOpacity
                    key={option}
                    disabled={loading}
                    onPress={() => setCategory(option)}
                    style={[styles.chip, { borderColor: active ? theme.accent : theme.border }]}>
                    <ThemedText
                      themeColor={active ? 'accent' : 'textSecondary'}
                      style={styles.chipText}>
                      {option}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <ThemedText themeColor="textMuted" style={styles.filterBlockLabel}>
              Ordenação
            </ThemedText>
            <View style={[styles.segmented, { borderColor: theme.border }]}>
              {ORDER_OPTIONS.map((option) => {
                const active = order === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    disabled={loading}
                    onPress={() => setOrder(option.value)}
                    style={[
                      styles.segment,
                      active && { backgroundColor: 'rgba(100,255,218,0.1)' },
                    ]}>
                    <ThemedText
                      themeColor={active ? 'accent' : 'textSecondary'}
                      style={styles.segmentText}>
                      {option.label}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>

            <ThemedText themeColor="textMuted" style={styles.filterBlockLabel}>
              Qualidade
            </ThemedText>
            <View style={styles.qualityList}>
              {QUALITY_OPTIONS.map((option) => {
                const active = quality === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    disabled={loading}
                    onPress={() => setQuality(option.value)}
                    style={[
                      styles.qualityCard,
                      { borderColor: active ? theme.accent : theme.border },
                    ]}>
                    <ThemedText
                      themeColor={active ? 'accent' : 'textSecondary'}
                      style={styles.qualityLabel}>
                      {option.label}
                    </ThemedText>
                    <ThemedText themeColor="textMuted" style={styles.qualityDetail}>
                      {option.detail}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>

            {!submittedQuery ? (
              <ThemedView type="backgroundElement" style={styles.emptyCard}>
                <ThemedText type="subtitle" style={styles.emptyTitle}>
                  Comece por uma busca
                </ThemedText>
                <ThemedText themeColor="textSecondary">
                  Digite um título, autor ou assunto para consultar a Open Library.
                </ThemedText>
              </ThemedView>
            ) : !loading && !error && books.length === 0 ? (
              <ThemedView type="backgroundElement" style={styles.emptyCard}>
                <ThemedText type="subtitle" style={styles.emptyTitle}>
                  Nenhum livro encontrado
                </ThemedText>
                <ThemedText themeColor="textSecondary">
                  Tente outros termos ou remova alguns filtros.
                </ThemedText>
              </ThemedView>
            ) : (
              <>
                <View style={styles.resultsHeader}>
                  <ThemedText style={styles.resultsTitle}>
                    Resultados para “{submittedQuery}”
                  </ThemedText>
                  <ThemedText themeColor="textMuted" style={styles.resultsCaption}>
                    {qualityCaption}
                  </ThemedText>
                  <ThemedText themeColor="textMuted" style={styles.resultsCount}>
                    {total.toLocaleString('pt-BR')} obra(s) encontrada(s)
                  </ThemedText>
                </View>

                <View style={styles.grid}>
                  {books.map((book) => (
                    <ThemedView key={book.id} type="backgroundElement" style={styles.card}>
                      {book.coverUrl ? (
                        <Image
                          source={{ uri: book.coverUrl }}
                          style={styles.cover}
                          contentFit="contain"
                          accessibilityLabel={`Capa de ${book.title}`}
                        />
                      ) : (
                        <View
                          style={[
                            styles.coverPlaceholder,
                            { backgroundColor: theme.backgroundSelected },
                          ]}>
                          <ThemedText themeColor="textMuted" style={styles.coverPlaceholderText}>
                            {book.title}
                          </ThemedText>
                        </View>
                      )}
                      <View style={styles.cardBody}>
                        <View
                          style={[
                            styles.categoryBadge,
                            { backgroundColor: 'rgba(100,255,218,0.08)' },
                          ]}>
                          <ThemedText themeColor="accent" style={styles.categoryText}>
                            {book.category}
                          </ThemedText>
                        </View>
                        <ThemedText style={styles.cardTitle} numberOfLines={2}>
                          {book.title}
                        </ThemedText>
                        <ThemedText
                          themeColor="textSecondary"
                          style={styles.cardAuthor}
                          numberOfLines={2}>
                          {book.authors.length ? book.authors.join(', ') : 'Autoria não informada'}
                        </ThemedText>
                        <ThemedText themeColor="textMuted" style={styles.cardDescription}>
                          {book.firstPublishYear
                            ? `Primeira publicação: ${book.firstPublishYear}`
                            : 'Ano não informado'}
                          {' · '}
                          {book.editionCount} edição(ões)
                        </ThemedText>
                        <TouchableOpacity
                          accessibilityRole="link"
                          onPress={() => void openBook(book)}>
                          <ThemedText themeColor="accent" style={styles.detailsLink}>
                            Ver na Open Library
                          </ThemedText>
                        </TouchableOpacity>
                      </View>
                    </ThemedView>
                  ))}
                </View>

                {hasMore && (
                  <TouchableOpacity
                    disabled={loadingMore}
                    onPress={loadMore}
                    style={[styles.loadMoreButton, { borderColor: theme.accent }]}>
                    {loadingMore ? (
                      <ActivityIndicator color={theme.accent} />
                    ) : (
                      <ThemedText themeColor="accent" style={styles.loadMoreText}>
                        Carregar mais
                      </ThemedText>
                    )}
                  </TouchableOpacity>
                )}
              </>
            )}

            <ThemedText themeColor="textMuted" style={styles.attribution}>
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
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
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
  card: { borderRadius: 16, overflow: 'hidden' },
  cover: { width: '100%', height: 220, backgroundColor: 'rgba(0,0,0,0.14)' },
  coverPlaceholder: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
  },
  coverPlaceholderText: { fontWeight: '800', textAlign: 'center' },
  cardBody: { padding: Spacing.three, gap: 8 },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  categoryText: { fontSize: 11, fontWeight: '800' },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  cardAuthor: { fontSize: 13, fontWeight: '700' },
  cardDescription: { fontSize: 13, lineHeight: 20 },
  detailsLink: { fontSize: 13, fontWeight: '800', paddingVertical: 8 },
  loadMoreButton: {
    minHeight: 48,
    marginTop: Spacing.four,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreText: { fontSize: 14, fontWeight: '800' },
  attribution: { marginTop: Spacing.four, fontSize: 11, lineHeight: 17, textAlign: 'center' },
});
