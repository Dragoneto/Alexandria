import { useMemo, useState } from 'react';
import { View, ScrollView, TouchableOpacity, Modal, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

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
  { label: 'Favoritos', value: 'FAVORITOS' },
];

interface Livro {
  titulo: string;
  autor: string;
  categoria: string;
  descricao: string;
  capa: string | null;
}

interface BibliotecaItem {
  id: string;
  favorito: boolean;
  statusLeitura: string;
  livro: Livro;
}

// Mock — substituir por listarBiblioteca(token) quando AuthContext existir
const MOCK_ITEMS: BibliotecaItem[] = [
  {
    id: '1',
    favorito: true,
    statusLeitura: 'LENDO',
    livro: {
      titulo: 'Dom Casmurro',
      autor: 'Machado de Assis',
      categoria: 'Literatura brasileira',
      descricao: 'A história de Bentinho e sua desconfiança sobre Capitu.',
      capa: null,
    },
  },
  {
    id: '2',
    favorito: false,
    statusLeitura: 'LIDO',
    livro: {
      titulo: 'O Hobbit',
      autor: 'J. R. R. Tolkien',
      categoria: 'Fantasia',
      descricao: 'Bilbo Bolseiro é levado numa aventura inesperada.',
      capa: null,
    },
  },
  {
    id: '3',
    favorito: false,
    statusLeitura: 'QUERO_LER',
    livro: {
      titulo: '1984',
      autor: 'George Orwell',
      categoria: 'Ficção política',
      descricao: 'Um retrato sombrio de vigilância e controle totalitário.',
      capa: null,
    },
  },
];

export default function Biblioteca() {
  const theme = useTheme();
  const [items, setItems] = useState(MOCK_ITEMS);
  const [filter, setFilter] = useState('TODOS');
  const [statusModalItemId, setStatusModalItemId] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    if (filter === 'TODOS') return items;
    if (filter === 'FAVORITOS') return items.filter((i) => i.favorito);
    return items.filter((i) => i.statusLeitura === filter);
  }, [filter, items]);

  const counters = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc.total += 1;
        if (item.statusLeitura === 'LENDO') acc.lendo += 1;
        if (item.favorito) acc.favoritos += 1;
        return acc;
      },
      { total: 0, lendo: 0, favoritos: 0 },
    );
  }, [items]);

  const handleStatusChange = (id: string, status: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, statusLeitura: status } : i)));
    setStatusModalItemId(null);
  };

  const handleFavorite = (id: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, favorito: !i.favorito } : i)));
  };

  const handleRemove = (id: string, titulo: string) => {
    Alert.alert('Remover livro', `Remover "${titulo}" da sua biblioteca?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: () => setItems((prev) => prev.filter((i) => i.id !== id)),
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
              <ThemedView type="backgroundElement" style={styles.statCard}>
                <ThemedText style={styles.statNumber}>{counters.favoritos}</ThemedText>
                <ThemedText themeColor="textMuted" style={styles.statLabel}>
                  Favoritos
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

            {/* GRID / EMPTY */}
            {filteredItems.length === 0 ? (
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
                {filteredItems.map((item: BibliotecaItem) => (
                  <ThemedView key={item.id} type="backgroundElement" style={styles.card}>
                    <View
                      style={[
                        styles.coverPlaceholder,
                        { backgroundColor: theme.backgroundSelected },
                      ]}>
                      <ThemedText themeColor="textMuted" style={styles.coverPlaceholderText}>
                        {item.livro.titulo}
                      </ThemedText>
                    </View>

                    <View style={styles.cardBody}>
                      <View
                        style={[
                          styles.categoryBadge,
                          { backgroundColor: 'rgba(100,255,218,0.08)' },
                        ]}>
                        <ThemedText themeColor="accent" style={styles.categoryText}>
                          {item.livro.categoria || 'Livro'}
                        </ThemedText>
                      </View>

                      <ThemedText style={styles.cardTitle}>{item.livro.titulo}</ThemedText>
                      <ThemedText themeColor="textSecondary" style={styles.cardAuthor}>
                        {item.livro.autor}
                      </ThemedText>
                      <ThemedText
                        themeColor="textMuted"
                        style={styles.cardDescription}
                        numberOfLines={3}>
                        {item.livro.descricao}
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
                          style={[
                            styles.favButton,
                            {
                              backgroundColor: item.favorito ? theme.accent : 'transparent',
                              borderColor: theme.accent,
                            },
                          ]}
                          onPress={() => handleFavorite(item.id)}>
                          <ThemedText
                            style={[
                              styles.favButtonText,
                              { color: item.favorito ? theme.background : theme.accent },
                            ]}>
                            {item.favorito ? 'Favorito' : 'Favoritar'}
                          </ThemedText>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.removeButton, { borderColor: theme.danger }]}
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
                onPress={() => statusModalItemId && handleStatusChange(statusModalItemId, value)}>
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
  coverPlaceholder: {
    height: 160,
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
  statusButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  statusButtonText: { fontSize: 13, fontWeight: '700' },
  actionsRow: { flexDirection: 'row', gap: Spacing.two, marginTop: 4 },
  favButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  favButtonText: { fontSize: 13, fontWeight: '800' },
  removeButton: {
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
