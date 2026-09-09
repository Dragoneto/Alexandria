import { useMemo, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const CATEGORY_OPTIONS = ['Todos', 'Fantasia', 'Romance', 'História', 'Tecnologia', 'Biografia', 'Mistério'];
const ORDER_OPTIONS = [
  { label: 'Mais relevantes', value: 'relevance' },
  { label: 'Mais recentes', value: 'newest' },
];
const QUALITY_OPTIONS = [
  { label: 'Precisos', value: 'precise', detail: 'Título ou autor' },
  { label: 'Curados', value: 'curated', detail: 'Capa e sinopse' },
  { label: 'Amplos', value: 'all', detail: 'Menos restrições' },
];

// Mock — substituir por searchBooks() real na Sprint 3
const MOCK_BOOKS = [
  { id: '1', title: 'Dom Casmurro', authors: 'Machado de Assis', category: 'Literatura brasileira', description: 'A história de Bentinho e sua desconfiança sobre Capitu.' },
  { id: '2', title: 'Torto Arado', authors: 'Itamar Vieira Junior', category: 'Romance', description: 'Duas irmãs e o sertão que carregam consigo.' },
  { id: '3', title: 'O Hobbit', authors: 'J. R. R. Tolkien', category: 'Fantasia', description: 'Bilbo Bolseiro é levado numa aventura inesperada.' },
];

export default function Explorar() {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todos');
  const [order, setOrder] = useState('relevance');
  const [quality, setQuality] = useState('precise');

  const hasActiveFilters = category !== 'Todos' || order !== 'relevance' || quality !== 'precise';

  const qualityCaption = useMemo(() => {
    if (quality === 'curated') return 'Resultados com boa apresentação, capa e sinopse.';
    if (quality === 'all') return 'Resultados amplos retornados pela busca.';
    return 'Resultados com match forte no título ou autor.';
  }, [quality]);

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>

            {/* HERO */}
            <ThemedText themeColor="accent" style={styles.eyebrow}>Explorar</ThemedText>
            <ThemedText type="title" style={styles.title}>Encontre livros para sua próxima leitura.</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              Pesquise, filtre e avance pelos resultados de forma rápida e organizada.
            </ThemedText>

            {/* SEARCH */}
            <View style={[styles.searchBox, { borderColor: theme.border }]}>
              <ThemedText themeColor="textMuted" style={styles.searchLabel}>
                Buscar por título, autor ou assunto
              </ThemedText>
              <View style={[styles.inputRow]}>
                <View style={[styles.input, { borderColor: theme.border }]}>
                  <ThemedText themeColor={query ? 'text' : 'textMuted'}>
                    {query || 'Ex.: Machado de Assis'}
                  </ThemedText>
                </View>
                <TouchableOpacity style={[styles.searchButton, { backgroundColor: theme.accent }]}>
                  <ThemedText style={[styles.searchButtonText, { color: theme.background }]}>Buscar</ThemedText>
                </TouchableOpacity>
              </View>
            </View>

            {/* FILTERS */}
            <View style={styles.filterHeader}>
              <View>
                <ThemedText style={styles.filterHeaderTitle}>Filtros</ThemedText>
                <ThemedText themeColor="textMuted" style={styles.filterHeaderSubtitle}>
                  {hasActiveFilters ? 'Busca refinada' : 'Padrão'}
                </ThemedText>
              </View>
              <TouchableOpacity
                disabled={!hasActiveFilters}
                onPress={() => {
                  setCategory('Todos');
                  setOrder('relevance');
                  setQuality('precise');
                }}
                style={[
                  styles.clearButton,
                  { borderColor: theme.border, opacity: hasActiveFilters ? 1 : 0.4 },
                ]}
              >
                <ThemedText themeColor="accent" style={styles.clearButtonText}>Limpar</ThemedText>
              </TouchableOpacity>
            </View>

            <ThemedText themeColor="textMuted" style={styles.filterBlockLabel}>Categorias</ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
              {CATEGORY_OPTIONS.map((option) => {
                const active = category === option;
                return (
                  <TouchableOpacity
                    key={option}
                    onPress={() => setCategory(option)}
                    style={[styles.chip, { borderColor: active ? theme.accent : theme.border }]}
                  >
                    <ThemedText themeColor={active ? 'accent' : 'textSecondary'} style={styles.chipText}>
                      {option}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <ThemedText themeColor="textMuted" style={styles.filterBlockLabel}>Ordenação</ThemedText>
            <View style={[styles.segmented, { borderColor: theme.border }]}>
              {ORDER_OPTIONS.map((option) => {
                const active = order === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => setOrder(option.value)}
                    style={[styles.segment, active && { backgroundColor: 'rgba(100,255,218,0.1)' }]}
                  >
                    <ThemedText themeColor={active ? 'accent' : 'textSecondary'} style={styles.segmentText}>
                      {option.label}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>

            <ThemedText themeColor="textMuted" style={styles.filterBlockLabel}>Qualidade</ThemedText>
            <View style={styles.qualityList}>
              {QUALITY_OPTIONS.map((option) => {
                const active = quality === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => setQuality(option.value)}
                    style={[styles.qualityCard, { borderColor: active ? theme.accent : theme.border }]}
                  >
                    <ThemedText themeColor={active ? 'accent' : 'textSecondary'} style={styles.qualityLabel}>
                      {option.label}
                    </ThemedText>
                    <ThemedText themeColor="textMuted" style={styles.qualityDetail}>{option.detail}</ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* RESULTS */}
            <View style={styles.resultsHeader}>
              <ThemedText style={styles.resultsTitle}>Resultados para “{query || 'literatura brasileira'}”</ThemedText>
              <ThemedText themeColor="textMuted" style={styles.resultsCaption}>{qualityCaption}</ThemedText>
              <ThemedText themeColor="textMuted" style={styles.resultsCount}>
                {MOCK_BOOKS.length} livro(s) encontrados
              </ThemedText>
            </View>

            <View style={styles.grid}>
              {MOCK_BOOKS.map((book) => (
                <ThemedView key={book.id} type="backgroundElement" style={styles.card}>
                  <View style={[styles.coverPlaceholder, { backgroundColor: theme.backgroundSelected }]}>
                    <ThemedText themeColor="textMuted" style={styles.coverPlaceholderText}>{book.title}</ThemedText>
                  </View>
                  <View style={styles.cardBody}>
                    <View style={[styles.categoryBadge, { backgroundColor: 'rgba(100,255,218,0.08)' }]}>
                      <ThemedText themeColor="accent" style={styles.categoryText}>{book.category}</ThemedText>
                    </View>
                    <ThemedText style={styles.cardTitle} numberOfLines={2}>{book.title}</ThemedText>
                    <ThemedText themeColor="textSecondary" style={styles.cardAuthor} numberOfLines={1}>
                      {book.authors}
                    </ThemedText>
                    <ThemedText themeColor="textMuted" style={styles.cardDescription} numberOfLines={4}>
                      {book.description}
                    </ThemedText>
                    <View style={styles.cardActions}>
                      <TouchableOpacity>
                        <ThemedText themeColor="accent" style={styles.detailsLink}>Ver detalhes</ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.saveButton, { backgroundColor: 'rgba(100,255,218,0.12)' }]}>
                        <ThemedText themeColor="accent" style={styles.saveButtonText}>Adicionar</ThemedText>
                      </TouchableOpacity>
                    </View>
                  </View>
                </ThemedView>
              ))}
            </View>

            <View style={styles.paginationRow}>
              <ThemedText themeColor="textMuted" style={styles.paginationText}>
                Você já visualizou todos os resultados desta busca.
              </ThemedText>
            </View>

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
  content: { width: '100%', maxWidth: MaxContentWidth, paddingHorizontal: Spacing.three, paddingBottom: Spacing.six },
  eyebrow: { marginTop: Spacing.four, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  title: { marginTop: Spacing.one, fontSize: 30, lineHeight: 34 },
  subtitle: { marginTop: Spacing.two, lineHeight: 22 },

  searchBox: { marginTop: Spacing.four, borderWidth: 1, borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  searchLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  inputRow: { gap: Spacing.two },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  searchButton: { borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  searchButtonText: { fontWeight: '800', fontSize: 14 },

  filterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.four },
  filterHeaderTitle: { fontSize: 15, fontWeight: '800' },
  filterHeaderSubtitle: { fontSize: 12, marginTop: 2 },
  clearButton: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  clearButtonText: { fontSize: 12, fontWeight: '800' },

  filterBlockLabel: { marginTop: Spacing.three, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  chipsScroll: { marginTop: Spacing.two },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, marginRight: Spacing.two },
  chipText: { fontSize: 13, fontWeight: '700' },

  segmented: { flexDirection: 'row', marginTop: Spacing.two, borderWidth: 1, borderRadius: 14, padding: 4, gap: 4 },
  segment: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  segmentText: { fontSize: 12, fontWeight: '800' },

  qualityList: { marginTop: Spacing.two, gap: Spacing.two },
  qualityCard: { borderWidth: 1, borderRadius: 14, padding: Spacing.three, gap: 2 },
  qualityLabel: { fontSize: 14, fontWeight: '800' },
  qualityDetail: { fontSize: 12 },

  resultsHeader: { marginTop: Spacing.five, gap: 4 },
  resultsTitle: { fontSize: 17, fontWeight: '800' },
  resultsCaption: { fontSize: 13, lineHeight: 19 },
  resultsCount: { fontSize: 12, marginTop: 4 },

  grid: { marginTop: Spacing.three, gap: Spacing.three },
  card: { borderRadius: 16, overflow: 'hidden' },
  coverPlaceholder: { height: 180, alignItems: 'center', justifyContent: 'center', padding: Spacing.three },
  coverPlaceholderText: { fontWeight: '800', textAlign: 'center' },
  cardBody: { padding: Spacing.three, gap: 8 },
  categoryBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  categoryText: { fontSize: 11, fontWeight: '800' },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  cardAuthor: { fontSize: 13, fontWeight: '700' },
  cardDescription: { fontSize: 13, lineHeight: 20 },
  cardActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  detailsLink: { fontSize: 13, fontWeight: '800' },
  saveButton: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  saveButtonText: { fontSize: 13, fontWeight: '800' },

  paginationRow: { marginTop: Spacing.four, alignItems: 'center' },
  paginationText: { fontSize: 13 },
});