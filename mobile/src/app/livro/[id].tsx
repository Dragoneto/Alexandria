import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AvaliacoesDoLivro } from '@/components/avaliacoes-do-livro';
import { FeedbackPressable } from '@/components/feedback-pressable';
import { ErrorState } from '@/components/error-state';
import { SkeletonBookDetail } from '@/components/skeletons';
import { PopupProgresso } from '@/components/popup-progresso';
import { ProgressoDoLivro } from '@/components/progresso-do-livro';
import { StatusNaBiblioteca } from '@/components/status-na-biblioteca';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DisabledOpacity, Mint, withAlpha } from '@/constants/design-system';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAvaliacoesDoLivro } from '@/hooks/use-avaliacoes-do-livro';
import { useItemDaBiblioteca } from '@/hooks/use-item-da-biblioteca';
import { useLoadingGate } from '@/hooks/use-loading-gate';
import { useTheme } from '@/hooks/use-theme';
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
  // Com o celular deitado a capa de 320px ocupava a tela toda e escondia título e status.
  const { height: alturaTela } = useWindowDimensions();
  const alturaCapa = Math.round(Math.min(320, Math.max(180, alturaTela * 0.5)));
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[]; avaliado?: string | string[] }>();
  const id = firstParam(params.id);
  const avaliado = firstParam(params.avaliado) === '1';
  const [book, setBook] = useState<BookDetail | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailStatus, setDetailStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const showLoading = useLoadingGate(loading);
  const [refresh, setRefresh] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);
  const [linkError, setLinkError] = useState('');
  // A Open Library pode redirecionar a obra; a biblioteca guarda o id que veio no detalhe.
  const biblioteca = useItemDaBiblioteca(book?.id ?? '');
  const avaliacoes = useAvaliacoesDoLivro(id);
  const minhaAvaliacao = avaliacoes.minha;
  const aguardandoAvaliacoes = avaliacoes.carregando && !avaliacoes.dados;
  // O parâmetro avaliado só vale até a lista nova chegar; depois manda o que a API disser.
  const jaAvaliouSemLista = avaliado && (!avaliacoes.dados || avaliacoes.atualizando);
  const avaliarBloqueado = !minhaAvaliacao && (jaAvaliouSemLista || aguardandoAvaliacoes);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      // Inicia fora do corpo síncrono do effect e evita uma renderização encadeada.
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setLoading(true);
      setDetailStatus('loading');
      setFailure(null);
      try {
        const result = await getBookDetail(id, controller.signal);
        setBook(result);
        setDetailStatus('success');
        setExpanded(false);
        setCoverFailed(false);
      } catch (error) {
        if (controller.signal.aborted) return;
        setBook(null);
        setDetailStatus('error');
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

  const showCover = !!book?.coverUrl && !coverFailed;
  const longDescription = (book?.description?.length ?? 0) > LONG_DESCRIPTION;

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            <FeedbackPressable
              // Aberto por link compartilhado não há tela anterior: volta para o início.
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
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
            </FeedbackPressable>

            {detailStatus === 'loading' ? (
              showLoading ? (
                <SkeletonBookDetail />
              ) : null
            ) : detailStatus === 'error' || failure || !book ? (
              <View style={styles.erro}>
                <ErrorState
                  title={failure?.title ?? 'Não foi possível abrir o livro'}
                  message={failure?.message ?? 'Tente de novo em instantes.'}
                  onRetry={
                    (failure?.canRetry ?? true) ? () => setRefresh((value) => value + 1) : undefined
                  }
                  secondaryAction={{
                    label: 'Explorar livros',
                    onPress: () => router.replace('/explore'),
                  }}
                />
              </View>
            ) : (
              <>
                {showCover ? (
                  <Image
                    source={{ uri: book.coverUrl ?? undefined }}
                    style={[styles.cover, { height: alturaCapa }]}
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
                    <ThemedText themeColor="textSecondary" style={styles.coverPlaceholderText}>
                      {book.title}
                    </ThemedText>
                  </View>
                )}

                <View style={styles.categories}>
                  {book.categories.length ? (
                    book.categories.map((category) => (
                      <View key={category} style={styles.categoryBadge}>
                        <ThemedText
                          themeColor="accent"
                          style={styles.categoryText}
                          numberOfLines={1}>
                          {category}
                        </ThemedText>
                      </View>
                    ))
                  ) : (
                    <ThemedText themeColor="textSecondary" style={styles.categoryText}>
                      Categoria não informada
                    </ThemedText>
                  )}
                </View>
                {book.categories.length > 0 && !book.categoriesTranslated && (
                  <ThemedText themeColor="textSecondary" style={styles.translationNote}>
                    Algumas categorias ainda estão no idioma original.
                  </ThemedText>
                )}

                <ThemedText type="title" style={styles.title}>
                  {book.title}
                </ThemedText>
                {book.titleTranslated && book.originalTitle !== book.title && (
                  <ThemedText themeColor="textSecondary" style={styles.author}>
                    Título original: {book.originalTitle}
                  </ThemedText>
                )}
                <ThemedText themeColor="textSecondary" style={styles.author}>
                  {book.authors.length ? book.authors.join(', ') : 'Autoria não informada'}
                </ThemedText>

                <ThemedText themeColor="textSecondary" style={styles.sectionLabel}>
                  Sinopse
                </ThemedText>
                {book.description ? (
                  <>
                    {/* Sinopse que já veio em português também chega com descriptionTranslated
                        false, então o aviso só aparece quando houve tradução de fato. */}
                    {book.descriptionTranslated && (
                      <ThemedText themeColor="textSecondary" style={styles.translationNote}>
                        Sinopse traduzida automaticamente para português.
                      </ThemedText>
                    )}
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
                  <ThemedText themeColor="textSecondary" style={styles.description}>
                    Este livro ainda não tem sinopse na Open Library.
                  </ThemedText>
                )}

                <StatusNaBiblioteca
                  item={biblioteca.item}
                  carregando={biblioteca.carregando}
                  erro={biblioteca.erro}
                  salvando={biblioteca.salvando}
                  erroAcao={biblioteca.erroAcao}
                  onTentarNovamente={biblioteca.tentarNovamente}
                  onAdicionar={() => void biblioteca.adicionar()}
                  onTrocarStatus={(status) => void biblioteca.trocarStatus(status)}
                  onRemover={() => void biblioteca.remover()}
                />
                {biblioteca.item?.statusLeitura === 'LENDO' && (
                  <ProgressoDoLivro
                    progresso={biblioteca.item.progresso}
                    onAtualizar={biblioteca.abrirProgresso}
                  />
                )}
                <PopupProgresso
                  visible={biblioteca.pedirProgresso}
                  titulo={book.title}
                  progresso={biblioteca.item?.progresso}
                  salvando={biblioteca.salvando === 'progresso'}
                  erro={biblioteca.erroProgresso}
                  onSalvar={(pagina, total) => void biblioteca.salvarProgresso(pagina, total)}
                  onFechar={biblioteca.fecharProgresso}
                />

                <TouchableOpacity
                  accessibilityRole="button"
                  disabled={avaliarBloqueado}
                  onPress={() =>
                    router.push({
                      pathname: '/avaliar/[id]',
                      params: minhaAvaliacao
                        ? { id: book.id, titulo: book.title, avaliacaoId: minhaAvaliacao.id }
                        : { id: book.id, titulo: book.title },
                    })
                  }
                  style={[
                    styles.rateButton,
                    { borderColor: theme.accent, opacity: avaliarBloqueado ? DisabledOpacity : 1 },
                  ]}>
                  <ThemedText themeColor="accent" style={styles.addButtonText}>
                    {minhaAvaliacao
                      ? 'Editar minha avaliação'
                      : jaAvaliouSemLista
                        ? 'Você avaliou este livro'
                        : 'Avaliar este livro'}
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

                <AvaliacoesDoLivro
                  dados={avaliacoes.dados}
                  status={avaliacoes.status}
                  carregando={avaliacoes.carregando}
                  erro={avaliacoes.erro}
                  carregandoMais={avaliacoes.carregandoMais}
                  erroMais={avaliacoes.erroMais}
                  onTentarNovamente={avaliacoes.tentarNovamente}
                  onCarregarMais={() => void avaliacoes.carregarMais()}
                  onEscreverAvaliacao={() =>
                    router.push({
                      pathname: '/avaliar/[id]',
                      params: { id: book.id, titulo: book.title },
                    })
                  }
                />
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
  backButton: {
    marginTop: Spacing.three,
    width: 44,
    height: 44,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  erro: { marginTop: Spacing.four },
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
    // Categorias longas da Open Library não podem passar da largura da tela.
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: withAlpha(Mint.mint400, 0.08),
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
  translationNote: { marginTop: Spacing.one, fontSize: 12, lineHeight: 17 },
  link: { fontSize: 13, fontWeight: '800', paddingVertical: Spacing.two },
  linkError: { fontSize: 13, lineHeight: 20 },
  addButtonText: { fontSize: 14, fontWeight: '800' },
  rateButton: {
    marginTop: Spacing.two,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attribution: { marginTop: Spacing.four, fontSize: 11, lineHeight: 17, textAlign: 'center' },
});
