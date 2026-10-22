import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import {
  atualizarItemBiblioteca,
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

const FILTERS = [
  { label: 'Todos', value: 'TODOS' },
  { label: 'Quero ler', value: 'QUERO_LER' },
  { label: 'Lendo', value: 'LENDO' },
  { label: 'Lido', value: 'LIDO' },
  { label: 'Abandonado', value: 'ABANDONADO' },
];

export default function Biblioteca() {
  const theme = useTheme();
  const [items, setItems] = useState<BibliotecaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [filter, setFilter] = useState('TODOS');
  const [statusModalItemId, setStatusModalItemId] = useState<number | null>(null);
  const [savingFavoriteId, setSavingFavoriteId] = useState<number | null>(null);

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

  const filteredItems = useMemo(() => {
    if (filter === 'TODOS') return items;
    return items.filter((i) => i.statusLeitura === filter);
  }, [filter, items]);

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

  const handleStatusChange = async (id: number, status: StatusLeitura) => {
    const anterior = items.find((item) => item.id === id);
    if (!anterior || anterior.statusLeitura === status) {
      setStatusModalItemId(null);
      return;
    }

    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, statusLeitura: status } : i)));
    setStatusModalItemId(null);
    try {
      await atualizarItemBiblioteca(id, { status });
    } catch (error) {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, statusLeitura: anterior.statusLeitura } : item)),
      );
      Alert.alert(
        'Não foi possível alterar o status',
        error instanceof ApiError ? error.message : 'Tente de novo em instantes.',
      );
    }
  };

  const handleFavorite = async (item: BibliotecaItem) => {
    if (savingFavoriteId !== null) return;
    const favorito = !item.favorito;
    setSavingFavoriteId(item.id);
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, favorito } : i)));
    try {
      await atualizarItemBiblioteca(item.id, { favorito });
    } catch (error) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, favorito: item.favorito } : i)),
      );
      Alert.alert(
        'Não foi possível alterar o favorito',
        error instanceof ApiError ? error.message : 'Tente de novo em instantes.',
      );
    } finally {
      setSavingFavoriteId(null);
    }
  };

 

    const handleRemove = (id: number, titulo: string) => {
    Alert.alert('Remover livro', `Remover "${titulo}" da sua biblioteca?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          try {
            await removerDaBiblioteca(id);
            setItems((prev) => prev.filter((i) => i.id !== id));
          } catch (error) {
            // 404 = já não estava no servidor; então pode sumir da tela também
            if (error instanceof ApiError && error.status === 404) {
              setItems((prev) => prev.filter((i) => i.id !== id));
              return;
            }
            Alert.alert(
              'Não foi possível remover',
              error instanceof ApiError ? error.message : 'Tente de novo em instantes.',
            );
          }
        },
      },
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
                <ThemedText themeColor="textMuted" style={styles.statLabel}>
                  Total
                </ThemedText>
              </ThemedView>
              <ThemedView type="backgroundElement" style={styles.statCard}>
                <ThemedText style={styles.statNumber}>{counters.lendo}</ThemedText>
                <ThemedText themeColor="textMuted" style={styles.statLabel}>
                  Lendo
                </ThemedText>
              </ThemedView>
            </View>

            {/* FILTERS */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filtersScroll}>
              {FILTERS.map((option) => {
                const active = filter === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => setFilter(option.value)}
                    style={[
                      styles.filterChip,
                      { borderColor: active ? theme.accent : theme.border },
                    ]}>
                    <ThemedText
                      themeColor={active ? 'accent' : 'textSecondary'}
                      style={styles.filterChipText}>
                      {option.label}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* LOADING / ERRO / VAZIO / GRID */}
            {loading ? (
              <ThemedView type="backgroundElement" style={styles.emptyCard}>
                <ActivityIndicator color={theme.accent} />
                <ThemedText themeColor="textSecondary">Carregando sua biblioteca…</ThemedText>
              </ThemedView>
            ) : erro ? (
              <ThemedView type="backgroundElement" style={styles.emptyCard}>
                <ThemedText type="subtitle" style={styles.emptyTitle}>
                  Não foi possível carregar
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                  {erro}
                </ThemedText>
              </ThemedView>
            ) : filteredItems.length === 0 ? (
              <ThemedView type="backgroundElement" style={styles.emptyCard}>
                <ThemedText type="subtitle" style={styles.emptyTitle}>
                  Nenhum livro neste filtro
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                  Adicione livros pela tela Explorar para preencher sua biblioteca.
                </ThemedText>
              </ThemedView>
            ) : (
              <View style={styles.grid}>
                {filteredItems.map((item) => (
                  <ThemedView key={item.id} type="backgroundElement" style={styles.card}>
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
                        <ThemedText themeColor="textMuted" style={styles.coverPlaceholderText}>
                          {item.livro.titulo}
                        </ThemedText>
                      </View>
                    )}

                    <View style={styles.cardBody}>
                      <ThemedText style={styles.cardTitle}>{item.livro.titulo}</ThemedText>
                      <ThemedText themeColor="textSecondary" style={styles.cardAuthor}>
                        {item.livro.autores.join(', ') || 'Autoria não informada'}
                      </ThemedText>

                      <TouchableOpacity
                        style={[styles.statusButton, { borderColor: theme.border }]}
                        onPress={() => setStatusModalItemId(item.id)}>
                        <ThemedText themeColor="textSecondary" style={styles.statusButtonText}>
                          {STATUS_LEITURA[item.statusLeitura]}
                        </ThemedText>
                      </TouchableOpacity>

                      <View style={styles.actionsRow}>
                        <TouchableOpacity
                          disabled={savingFavoriteId !== null}
                          style={[styles.actionButton, { borderColor: theme.accent }]}
                          onPress={() => void handleFavorite(item)}>
                          <ThemedText themeColor="accent" style={styles.favButtonText}>
                            {item.favorito ? 'Favorito' : 'Favoritar'}
                          </ThemedText>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionButton, { borderColor: theme.danger }]}
                          onPress={() => handleRemove(item.id, item.livro.titulo)}>
                          <ThemedText themeColor="danger" style={styles.removeButtonText}>
                            Remover
                          </ThemedText>
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
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setStatusModalItemId(null)}>
          <ThemedView type="backgroundElement" style={styles.modalCard}>
            <ThemedText type="smallBold" style={styles.modalTitle}>
              Status de leitura
            </ThemedText>
            {Object.entries(STATUS_LEITURA).map(([value, label]) => (
              <TouchableOpacity
                key={value}
                style={styles.modalOption}
                onPress={() => {
                  if (statusModalItemId !== null) {
                    handleStatusChange(statusModalItemId, value as StatusLeitura);
                  }
                }}>
                <ThemedText themeColor="textSecondary">{label}</ThemedText>
              </TouchableOpacity>
            ))}
          </ThemedView>
        </TouchableOpacity>
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
  filtersScroll: { marginTop: Spacing.four, marginBottom: Spacing.three },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: Spacing.two,
  },
  filterChipText: { fontSize: 13, fontWeight: '700' },
  emptyCard: { borderRadius: 16, padding: Spacing.four, gap: 8 },
  emptyTitle: { fontSize: 18 },
  emptyText: { lineHeight: 22 },
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
  cardBody: { padding: Spacing.three, gap: 8 },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  cardAuthor: { fontSize: 13, fontWeight: '700' },
  statusButton: {
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
  modalOption: { paddingVertical: Spacing.two },
});
