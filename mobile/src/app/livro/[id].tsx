import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/services/api';
import { adicionarNaBiblioteca } from '@/services/biblioteca';
import {
  describeSearchError,
  getBookDetail,
  OpenLibraryError,
  type BookDetail,
} from '@/services/open-library';

const LONG_DESCRIPTION = 320;
const COLLAPSED_LINES = 6;

type Failure = { title: string; message: string; canRetry: boolean };

function describeFailure(error: unknown): Failure {
  if (error instanceof OpenLibraryError && error.kind === 'notFound') {
    return {
      title: 'Livro não encontrado',
      message: 'Esta obra não está disponível na Open Library.',
      canRetry: false,
    };
  }
  return {
    title: 'Não foi possível abrir o livro',
    message: describeSearchError(error).message,
    canRetry: true,
  };
}

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export default function DetalheDoLivro() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[]; avaliado?: string | string[] }>();
  const id = firstParam(params.id);
  const avaliado = firstParam(params.avaliado) === '1';
  const [book, setBook] = useState<BookDetail | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [addState, setAddState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [addError, setAddError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      // Inicia fora do corpo síncrono do effect e evita uma renderização encadeada.
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setLoading(true);
      setFailure(null);
      try {
        const result = await getBookDetail(id, controller.signal);
        setBook(result);
        setExpanded(false);
        setCoverFailed(false);
      } catch (error) {
        if (controller.signal.aborted) return;
        setBook(null);
        setFailure(describeFailure(error));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [id, refresh]);

  const openInOpenLibrary = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      setLinkError('Não foi possível abrir a página da obra.');
    }
  };

  const adicionar = async () => {
    if (!book) return;
    setAddState('saving');
    setAddError('');
    try {
      await adicionarNaBiblioteca(book.id);
      setAddState('saved');
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setAddState('saved'); // já estava na biblioteca
        return;
      }
      setAddState('idle');
      setAddError(
        error instanceof ApiError ? error.message : 'Não foi possível adicionar o livro.',
      );
    }
  };

  const showCover = !!book?.coverUrl && !coverFailed;
  const longDescription = (book?.description?.length ?? 0) > LONG_DESCRIPTION;

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Voltar"
              style={[
                styles.backButton,
                { borderColor: theme.border, backgroundColor: theme.backgroundElement },
              ]}>
              <SymbolView
                name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
                size={20}
                tintColor={theme.accent}
              />
            </Pressable>

            {loading ? (
              <ThemedView
                type="backgroundElement"
                style={styles.stateCard}
                accessibilityLiveRegion="polite">
                <ActivityIndicator accessibilityLabel="Carregando livro" color={theme.accent} />
                <ThemedText themeColor="textSecondary">Carregando o livro…</ThemedText>
              </ThemedView>
            ) : failure || !book ? (
              <ThemedView
                type="backgroundElement"
                style={styles.stateCard}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite">
                <ThemedText type="subtitle" style={styles.stateTitle}>
                  {failure?.title ?? 'Não foi possível abrir o livro'}
                </ThemedText>
                <ThemedText themeColor="textSecondary">
                  {failure?.message ?? 'Tente de novo em instantes.'}
                </ThemedText>
                {(failure?.canRetry ?? true) && (
                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => setRefresh((value) => value + 1)}
                    style={[styles.outlineButton, { borderColor: theme.accent }]}>
                    <ThemedText themeColor="accent" style={styles.outlineButtonText}>
                      Tentar novamente
                    </ThemedText>
                  </TouchableOpacity>
                )}
              </ThemedView>
            ) : (
              <>
                {showCover ? (
                  <Image
                    source={{ uri: book.coverUrl ?? undefined }}
                    style={styles.cover}
                    contentFit="contain"
                    accessibilityLabel={`Capa de ${book.title}`}
                    onError={() => setCoverFailed(true)}
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

                <View style={styles.categories}>
                  {book.categories.length ? (
                    book.categories.map((category) => (
                      <View key={category} style={styles.categoryBadge}>
                        <ThemedText themeColor="accent" style={styles.categoryText}>
                          {category}
                        </ThemedText>
                      </View>
                    ))
                  ) : (
                    <ThemedText themeColor="textMuted" style={styles.categoryText}>
                      Categoria não informada
                    </ThemedText>
                  )}
                </View>

                <ThemedText type="title" style={styles.title}>
                  {book.title}
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.author}>
                  {book.authors.length ? book.authors.join(', ') : 'Autoria não informada'}
                </ThemedText>

                <ThemedText themeColor="textMuted" style={styles.sectionLabel}>
                  Sinopse
                </ThemedText>
                {book.description ? (
                  <>
                    <ThemedText
                      themeColor="textSecondary"
                      style={styles.description}
                      numberOfLines={longDescription && !expanded ? COLLAPSED_LINES : undefined}>
                      {book.description}
                    </ThemedText>
                    {longDescription && (
                      <TouchableOpacity
                        accessibilityRole="button"
                        onPress={() => setExpanded((value) => !value)}>
                        <ThemedText themeColor="accent" style={styles.link}>
                          {expanded ? 'Mostrar menos' : 'Ler sinopse completa'}
                        </ThemedText>
                      </TouchableOpacity>
                    )}
                  </>
                ) : (
                  <ThemedText themeColor="textMuted" style={styles.description}>
                    Este livro ainda não tem sinopse na Open Library.
                  </ThemedText>
                )}

                <TouchableOpacity
                  accessibilityRole="button"
                  disabled={addState !== 'idle'}
                  onPress={() => void adicionar()}
                  style={[
                    styles.addButton,
                    { backgroundColor: theme.accent, opacity: addState === 'idle' ? 1 : 0.6 },
                  ]}>
                  <ThemedText style={[styles.addButtonText, { color: theme.background }]}>
                    {addState === 'saving'
                      ? 'Adicionando…'
                      : addState === 'saved'
                        ? 'Na sua biblioteca ✓'
                        : 'Adicionar à biblioteca'}
                  </ThemedText>
                </TouchableOpacity>
                {!!addError && (
                  <ThemedText themeColor="danger" style={styles.addHint}>
                    {addError}
                  </ThemedText>
                )}

                <TouchableOpacity
                  accessibilityRole="button"
                  disabled={avaliado}
                  onPress={() =>
                    router.push({
                      pathname: '/avaliar/[id]',
                      params: { id: book.id, titulo: book.title },
                    })
                  }
                  style={[
                    styles.rateButton,
                    { borderColor: theme.accent, opacity: avaliado ? 0.6 : 1 },
                  ]}>
                  <ThemedText themeColor="accent" style={styles.addButtonText}>
                    {avaliado ? 'Você avaliou este livro' : 'Avaliar este livro'}
                  </ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  accessibilityRole="link"
                  onPress={() => void openInOpenLibrary(book.openLibraryUrl)}>
                  <ThemedText themeColor="accent" style={styles.link}>
                    Ver na Open Library
                  </ThemedText>
                </TouchableOpacity>
                {!!linkError && (
                  <ThemedText themeColor="danger" style={styles.linkError}>
                    {linkError}
                  </ThemedText>
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
  backButton: {
    marginTop: Spacing.three,
    width: 44,
    height: 44,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateCard: { marginTop: Spacing.four, borderRadius: 16, padding: Spacing.four, gap: 8 },
  stateTitle: { fontSize: 18, lineHeight: 26 },
  outlineButton: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineButtonText: { fontSize: 14, fontWeight: '800' },
  cover: {
    marginTop: Spacing.four,
    width: '100%',
    height: 320,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.14)',
  },
  coverPlaceholder: {
    marginTop: Spacing.four,
    height: 220,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
  },
  coverPlaceholderText: { fontWeight: '800', textAlign: 'center' },
  categories: {
    marginTop: Spacing.four,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(100,255,218,0.08)',
  },
  categoryText: { fontSize: 11, fontWeight: '800' },
  title: { marginTop: Spacing.three, fontSize: 28, lineHeight: 34 },
  author: { marginTop: Spacing.one, fontSize: 15, fontWeight: '700' },
  sectionLabel: {
    marginTop: Spacing.four,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  description: { marginTop: Spacing.two, fontSize: 15, lineHeight: 23 },
  link: { fontSize: 13, fontWeight: '800', paddingVertical: Spacing.two },
  linkError: { fontSize: 13, lineHeight: 20 },
  addButton: {
    marginTop: Spacing.four,
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { fontSize: 14, fontWeight: '800' },
  rateButton: {
    marginTop: Spacing.two,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addHint: { marginTop: Spacing.two, marginBottom: Spacing.two, fontSize: 12, textAlign: 'center' },
  attribution: { marginTop: Spacing.four, fontSize: 11, lineHeight: 17, textAlign: 'center' },
});
