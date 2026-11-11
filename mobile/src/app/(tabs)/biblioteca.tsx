import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { EmptyState } from '@/components/empty_state';
import { ErrorState } from '@/components/error-state';
import { SkeletonGrid } from '@/components/skeletons';
import { DisabledOpacity, TouchMin } from '@/constants/design-system';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useFoco } from '@/hooks/use-foco';
import { useTheme } from '@/hooks/use-theme';
import { useLoadingGate } from '@/hooks/use-loading-gate';
import { ApiError } from '@/services/api';
import {
  atualizarItemBiblioteca,
  filtrarBiblioteca,
  listarBiblioteca,
  removerDaBiblioteca,
  type BibliotecaItem,
  type StatusLeitura,
} from '@/services/biblioteca';

const STATUS_LEITURA: Record<string, string> = {
  QUERO_LER: 'Quero ler',
  LENDO: 'Lendo',
  LIDO: 'Lido',
  ABANDONADO: 'Abandonado',
};

type FiltroStatus = StatusLeitura | 'TODOS';

const FILTERS: { label: string; value: FiltroStatus }[] = [
  { label: 'Todos', value: 'TODOS' },
  { label: 'Quero ler', value: 'QUERO_LER' },
  { label: 'Lendo', value: 'LENDO' },
  { label: 'Lido', value: 'LIDO' },
  { label: 'Abandonado', value: 'ABANDONADO' },
];

export default function Biblioteca() {
  const theme = useTheme();
  const router = useRouter();
  const [items, setItems] = useState<BibliotecaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [filter, setFilter] = useState<FiltroStatus>('TODOS');
  const [somenteFavoritos, setSomenteFavoritos] = useState(false);
  const [busca, setBusca] = useState('');
  const { focado: buscaFocada, propsDeFoco } = useFoco();
  const [statusModalItemId, setStatusModalItemId] = useState<number | null>(null);
  const [savingFavoriteId, setSavingFavoriteId] = useState<number | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const pendingStatus = useRef(new Set<number>());
  const [savingStatusIds, setSavingStatusIds] = useState<number[]>([]);
  const [aviso, setAviso] = useState('');
  const showLoading = useLoadingGate(loading);

  // Recarrega toda vez que a aba ganha foco (ex.: depois de adicionar um livro)
  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      listarBiblioteca(controller.signal)
        .then((itens) => {
          setItems(itens);
          setErro('');
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          setErro(
            error instanceof ApiError ? error.message : 'Não foi possível carregar sua biblioteca.',
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
      return () => controller.abort();
    }, []),
  );

  const filteredItems = useMemo(
    () =>
      filtrarBiblioteca(items, {
        status: filter === 'TODOS' ? null : filter,
        somenteFavoritos,
        busca,
      }),
    [filter, somenteFavoritos, busca, items],
  );

  const buscaAtiva = busca.trim().length > 0;
  const outrosFiltrosAtivos = filter !== 'TODOS' || somenteFavoritos;

  let emptyMessage = 'Escolha outro filtro para ver os demais livros.';
  if (items.length === 0) {
    emptyMessage = 'Adicione livros pela tela Explorar para preencher sua biblioteca.';
  } else if (buscaAtiva) {
    emptyMessage = outrosFiltrosAtivos
      ? 'Nenhum livro combina com a busca e os filtros escolhidos.'
      : 'Nenhum livro da sua biblioteca combina com essa busca.';
  } else if (somenteFavoritos) {
    emptyMessage = 'Toque em Favoritar num livro para ele aparecer aqui, ou troque o filtro.';
  }

  const limparBuscaEFiltros = () => {
    setBusca('');
    setFilter('TODOS');
    setSomenteFavoritos(false);
  };

  const abrirLivro = (livroId: string) => {
    router.push({ pathname: '/livro/[id]', params: { id: livroId } });
  };

  const counters = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc.total += 1;
        if (item.statusLeitura === 'LENDO') acc.lendo += 1;
        return acc;
      },
      { total: 0, lendo: 0 },
    );
  }, [items]);

  const avisar = (texto: string) => {
    setAviso(texto);
    // No Android e no web, a região ao vivo já anuncia; o iOS precisa do anúncio direto.
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(texto);
  };

  // Alert.alert não faz nada no web, então lá o erro aparece no aviso da tela.
  const avisarErro = (titulo: string, mensagem: string) => {
    if (Platform.OS === 'web') avisar(`${titulo}. ${mensagem}`);
    else Alert.alert(titulo, mensagem);
  };

  const handleStatusChange = async (id: number, status: StatusLeitura) => {
    if (pendingStatus.current.has(id)) return;
    const anterior = items.find((item) => item.id === id);
    if (!anterior || anterior.statusLeitura === status) {
      setStatusModalItemId(null);
      return;
    }

    pendingStatus.current.add(id);
    setSavingStatusIds([...pendingStatus.current]);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, statusLeitura: status } : i)));
    setStatusModalItemId(null);
    try {
      await atualizarItemBiblioteca(id, { status });
      avisar(`Status alterado para ${STATUS_LEITURA[status]}`);
    } catch (error) {
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, statusLeitura: anterior.statusLeitura } : item,
        ),
      );
      avisarErro(
        'Não foi possível alterar o status',
        error instanceof ApiError ? error.message : 'Tente de novo em instantes.',
      );
    } finally {
      pendingStatus.current.delete(id);
      setSavingStatusIds([...pendingStatus.current]);
    }
  };

  const handleFavorite = async (item: BibliotecaItem) => {
    if (savingFavoriteId !== null) return;
    const favorito = !item.favorito;
    setSavingFavoriteId(item.id);
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, favorito } : i)));
    try {
      await atualizarItemBiblioteca(item.id, { favorito });
      avisar(favorito ? 'Adicionado aos favoritos' : 'Removido dos favoritos');
    } catch (error) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, favorito: item.favorito } : i)),
      );
      avisarErro(
        'Não foi possível alterar o favorito',
        error instanceof ApiError ? error.message : 'Tente de novo em instantes.',
      );
    } finally {
      setSavingFavoriteId(null);
    }
  };

  const remover = async (id: number) => {
    if (removingId !== null) return;
    setRemovingId(id);
    try {
      await removerDaBiblioteca(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      avisar('Livro removido da biblioteca');
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setItems((prev) => prev.filter((i) => i.id !== id));
        avisar('Livro removido da biblioteca');
        return;
      }
      avisarErro(
        'Não foi possível remover',
        error instanceof ApiError ? error.message : 'Tente de novo em instantes.',
      );
    } finally {
      setRemovingId(null);
    }
  };

  const handleRemove = (id: number, titulo: string) => {
    const confirmar = () => {
      void remover(id);
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Remover "${titulo}" da sua biblioteca?`)) confirmar();
      return;
    }
    Alert.alert('Remover livro', `Remover "${titulo}" da sua biblioteca?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: confirmar },
    ]);
  };

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            {/* HEADER */}
            <ThemedText themeColor="accent" style={styles.eyebrow}>
              Biblioteca
            </ThemedText>
            <ThemedText type="title" style={styles.title}>
              Sua estante de leitura
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              Organize livros salvos, acompanhe status e marque favoritos.
            </ThemedText>

            {/* STATS */}
            <View style={styles.statsRow}>
              <ThemedView type="backgroundElement" style={styles.statCard}>
                <ThemedText style={styles.statNumber}>{counters.total}</ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.statLabel}>
                  Total
                </ThemedText>
              </ThemedView>
              <ThemedView type="backgroundElement" style={styles.statCard}>
                <ThemedText style={styles.statNumber}>{counters.lendo}</ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.statLabel}>
                  Lendo
                </ThemedText>
              </ThemedView>
            </View>

            <View style={styles.searchContainer}>
              <TextInput
                accessibilityLabel="Buscar na biblioteca por título ou autor"
                style={[
                  styles.searchInput,
                  {
                    borderColor: buscaFocada ? theme.accent : theme.border,
                    color: theme.text,
                    paddingRight: busca ? 40 : 14,
                  },
                ]}
                placeholder="Buscar por título ou autor"
                placeholderTextColor={theme.textMuted}
                value={busca}
                onChangeText={setBusca}
                {...propsDeFoco}
                returnKeyType="search"
                autoCorrect={false}
              />
              {!!busca && (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Limpar busca"
                  onPress={() => setBusca('')}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.clearSearchButton}>
                  <ThemedText themeColor="textSecondary" style={styles.clearSearchIcon}>
                    ✕
                  </ThemedText>
                </TouchableOpacity>
              )}
            </View>

            {/* FILTERS */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filtersScroll}>
              <View
                accessibilityRole="radiogroup"
                accessibilityLabel="Filtrar livros por status"
                style={styles.filtersRow}>
                {FILTERS.map((option) => {
                  const active = filter === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      accessibilityRole="radio"
                      accessibilityLabel={`Filtrar por ${option.label}`}
                      aria-checked={active}
                      onPress={() => setFilter(option.value)}
                      style={[
                        styles.filterChip,
                        { borderColor: active ? theme.accent : theme.border },
                      ]}>
                      <ThemedText
                        themeColor={active ? 'accent' : 'textSecondary'}
                        style={styles.filterChipText}>
                        {active ? `✓ ${option.label}` : option.label}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity
                onPress={() => setSomenteFavoritos((atual) => !atual)}
                accessibilityRole="togglebutton"
                accessibilityState={{ checked: somenteFavoritos }}
                aria-pressed={somenteFavoritos}
                accessibilityLabel="Mostrar só favoritos"
                style={[
                  styles.filterChip,
                  { borderColor: somenteFavoritos ? theme.accent : theme.border },
                ]}>
                <ThemedText
                  themeColor={somenteFavoritos ? 'accent' : 'textSecondary'}
                  style={styles.filterChipText}>
                  {somenteFavoritos ? '✓ Favoritos' : 'Favoritos'}
                </ThemedText>
              </TouchableOpacity>
            </ScrollView>

            {/* Sempre montado: a região ao vivo pode não anunciar um elemento recém-criado. */}
            <ThemedText
              accessibilityLiveRegion="polite"
              themeColor="textSecondary"
              style={styles.aviso}>
              {aviso}
            </ThemedText>

            {/* LOADING / ERRO / VAZIO / GRID */}
            {loading ? (
              showLoading ? (
                <ThemedView
                  accessibilityLiveRegion="polite"
                  type="backgroundElement"
                  style={styles.emptyCard}>
                  <SkeletonGrid />
                </ThemedView>
              ) : null
            ) : erro ? (
              <ErrorState
                message={erro}
                onRetry={() => {
                  setLoading(true);
                  setErro('');
                  listarBiblioteca()
                    .then(setItems)
                    .catch((failure) =>
                      setErro(
                        failure instanceof ApiError
                          ? failure.message
                          : 'Não foi possível carregar sua biblioteca.',
                      ),
                    )
                    .finally(() => setLoading(false));
                }}
              />
            ) : filteredItems.length === 0 ? (
              items.length === 0 ? (
                <EmptyState
                  compact
                  title="Sua biblioteca está vazia"
                  message="Salve livros no Explorar para organizar suas leituras e acompanhar seu progresso."
                  primaryAction={{
                    label: 'Explorar livros',
                    onPress: () => router.push('/explore'),
                  }}
                />
              ) : (
                <ThemedView type="backgroundElement" style={styles.emptyCard}>
                  <ThemedText type="subtitle" style={styles.emptyTitle}>
                    {buscaAtiva ? 'Nenhum livro encontrado' : 'Nenhum livro neste filtro'}
                  </ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                    {emptyMessage}
                  </ThemedText>
                  {(buscaAtiva || outrosFiltrosAtivos) && (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={buscaAtiva ? 'Limpar busca e filtros' : 'Limpar filtros'}
                      onPress={limparBuscaEFiltros}
                      style={[styles.clearFiltersButton, { borderColor: theme.accent }]}>
                      <ThemedText themeColor="accent" style={styles.clearFiltersText}>
                        {buscaAtiva ? 'Limpar busca e filtros' : 'Limpar filtros'}
                      </ThemedText>
                    </TouchableOpacity>
                  )}
                </ThemedView>
              )
            ) : (
              <View style={styles.grid}>
                {filteredItems.map((item) => (
                  <ThemedView key={item.id} type="backgroundElement" style={styles.card}>
                    <TouchableOpacity
                      onPress={() => abrirLivro(item.livro.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Abrir detalhes de ${item.livro.titulo}`}>
                      {item.livro.capa ? (
                        <Image
                          source={{ uri: item.livro.capa }}
                          style={[styles.cover, { backgroundColor: theme.backgroundSelected }]}
                          contentFit="contain"
                          accessibilityLabel={`Capa de ${item.livro.titulo}`}
                        />
                      ) : (
                        <View
                          style={[
                            styles.coverPlaceholder,
                            { backgroundColor: theme.backgroundSelected },
                          ]}>
                          <ThemedText
                            themeColor="textSecondary"
                            style={styles.coverPlaceholderText}>
                            {item.livro.titulo}
                          </ThemedText>
                        </View>
                      )}

                      <View style={styles.cardHeading}>
                        <ThemedText style={styles.cardTitle}>{item.livro.titulo}</ThemedText>
                        <ThemedText themeColor="textSecondary" style={styles.cardAuthor}>
                          {item.livro.autores.join(', ') || 'Autoria não informada'}
                        </ThemedText>
                      </View>
                    </TouchableOpacity>

                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={`Status de leitura de ${item.livro.titulo}: ${STATUS_LEITURA[item.statusLeitura]}. Alterar`}
                        aria-disabled={savingStatusIds.includes(item.id)}
                        aria-busy={savingStatusIds.includes(item.id)}
                        disabled={savingStatusIds.includes(item.id)}
                        style={[
                          styles.statusButton,
                          { borderColor: theme.border },
                          savingStatusIds.includes(item.id) && { opacity: DisabledOpacity },
                        ]}
                        onPress={() => setStatusModalItemId(item.id)}>
                        <ThemedText themeColor="textSecondary" style={styles.statusButtonText}>
                          {savingStatusIds.includes(item.id)
                            ? 'Salvando…'
                            : STATUS_LEITURA[item.statusLeitura]}
                        </ThemedText>
                      </TouchableOpacity>

                      <View style={styles.actionsRow}>
                        <TouchableOpacity
                          accessibilityRole="button"
                          accessibilityLabel={`${item.favorito ? 'Favorito' : 'Favoritar'}: ${item.livro.titulo}`}
                          aria-selected={item.favorito}
                          aria-disabled={savingFavoriteId !== null}
                          aria-busy={savingFavoriteId === item.id}
                          accessibilityState={{
                            disabled: savingFavoriteId !== null,
                            busy: savingFavoriteId === item.id,
                          }}
                          disabled={savingFavoriteId !== null}
                          style={[
                            styles.actionButton,
                            { borderColor: theme.accent },
                            savingFavoriteId !== null && { opacity: DisabledOpacity },
                          ]}
                          onPress={() => void handleFavorite(item)}>
                          <ThemedText themeColor="accent" style={styles.favButtonText}>
                            {savingFavoriteId === item.id
                              ? 'Salvando…'
                              : item.favorito
                                ? 'Favorito'
                                : 'Favoritar'}
                          </ThemedText>
                        </TouchableOpacity>
                        <TouchableOpacity
                          accessibilityRole="button"
                          accessibilityLabel={`Remover ${item.livro.titulo} da biblioteca`}
                          disabled={removingId !== null}
                          aria-busy={removingId === item.id}
                          accessibilityState={{
                            disabled: removingId !== null,
                            busy: removingId === item.id,
                          }}
                          style={[
                            styles.actionButton,
                            {
                              borderColor: theme.danger,
                              opacity: removingId !== null ? DisabledOpacity : 1,
                            },
                          ]}
                          onPress={() => handleRemove(item.id, item.livro.titulo)}>
                          {removingId === item.id ? (
                            <ActivityIndicator
                              color={theme.danger}
                              accessibilityLabel="Removendo livro"
                            />
                          ) : (
                            <ThemedText themeColor="danger" style={styles.removeButtonText}>
                              Remover
                            </ThemedText>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  </ThemedView>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* STATUS MODAL */}
      <Modal
        visible={statusModalItemId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setStatusModalItemId(null)}>
        {/* O fundo fica ao lado das opções: se as envolvesse, o leitor de tela não as alcançaria. */}
        <View style={styles.modalOverlay}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            style={StyleSheet.absoluteFill}
            onPress={() => setStatusModalItemId(null)}
          />
          <ThemedView
            accessibilityRole="radiogroup"
            accessibilityLabel="Status de leitura"
            type="backgroundElement"
            style={styles.modalCard}>
            <ThemedText type="smallBold" accessibilityRole="header" style={styles.modalTitle}>
              Status de leitura
            </ThemedText>
            {Object.entries(STATUS_LEITURA).map(([value, label]) => {
              const atual = items.find((i) => i.id === statusModalItemId)?.statusLeitura === value;
              return (
                <TouchableOpacity
                  key={value}
                  accessibilityRole="radio"
                  accessibilityLabel={label}
                  aria-checked={atual}
                  style={styles.modalOption}
                  onPress={() => {
                    if (statusModalItemId !== null) {
                      handleStatusChange(statusModalItemId, value as StatusLeitura);
                    }
                  }}>
                  <ThemedText themeColor="textSecondary">{atual ? `✓ ${label}` : label}</ThemedText>
                </TouchableOpacity>
              );
            })}
          </ThemedView>
        </View>
      </Modal>
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
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: Spacing.four,
  },
  title: { marginTop: Spacing.one, fontSize: 30, lineHeight: 34 },
  subtitle: { marginTop: Spacing.two, lineHeight: 22 },
  statsRow: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.four },
  statCard: { flex: 1, borderRadius: 16, padding: Spacing.three, gap: 4 },
  statNumber: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 12 },
  searchContainer: { marginTop: Spacing.four, justifyContent: 'center' },
  searchInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  clearSearchButton: {
    position: 'absolute',
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearSearchIcon: { fontSize: 14 },
  filtersScroll: { marginTop: Spacing.three, marginBottom: Spacing.three },
  filterChip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: Spacing.two,
  },
  filtersRow: { flexDirection: 'row' },
  filterChipText: { fontSize: 13, fontWeight: '700' },
  aviso: { marginBottom: Spacing.two, fontSize: 14 },
  emptyCard: { borderRadius: 16, padding: Spacing.four, gap: 8 },
  emptyTitle: { fontSize: 18 },
  emptyText: { lineHeight: 22 },
  clearFiltersButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 4,
  },
  clearFiltersText: { fontSize: 13, fontWeight: '800' },
  grid: { gap: Spacing.three },
  card: { borderRadius: 16, overflow: 'hidden' },
  cover: { width: '100%', height: 200 },
  coverPlaceholder: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
  },
  coverPlaceholderText: { fontWeight: '800', textAlign: 'center' },
  cardHeading: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three, gap: 8 },
  cardActions: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    paddingTop: 8,
    gap: 8,
  },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  cardAuthor: { fontSize: 13, fontWeight: '700' },
  statusButton: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  statusButtonText: { fontSize: 13, fontWeight: '700' },
  actionsRow: { flexDirection: 'row', gap: Spacing.two, marginTop: 4 },
  favButtonText: { fontSize: 13, fontWeight: '800' },
  actionButton: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  removeButtonText: { fontSize: 13, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.four,
    gap: Spacing.one,
  },
  modalTitle: { marginBottom: Spacing.two },
  modalOption: { minHeight: TouchMin, justifyContent: 'center' },
});
