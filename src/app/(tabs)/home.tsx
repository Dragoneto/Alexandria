import { useState } from 'react';
import {
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  View,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

const GOLD = '#f4b860';
const CYAN = '#5ce0d2';
const BG = '#0a0e13';
const CARD_BG = 'rgba(14, 21, 28, 0.82)';
const BORDER = 'rgba(204, 214, 246, 0.08)';
const WHITE = '#ffffff';
const TEXT_PRIMARY = '#d7e2ef';
const TEXT_SECONDARY = '#b9c5d7';
const TEXT_MUTED = '#94a3b8';

export default function HomeScreen() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');

  const handleSearch = () => {
    const normalized = searchTerm.trim();
    if (!normalized) {
      setError('Digite o título de um livro para continuar.');
      return;
    }
    setError('');
    router.push(`/explore?q=${encodeURIComponent(normalized)}` as any);
  };

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SafeAreaView style={styles.safe}>

          {/* ── HERO ── */}
          <View style={styles.hero}>
            <Text style={styles.kicker}>Alexandria</Text>
            <Text style={styles.heading}>
              Sua biblioteca pessoal{'\n'}começa aqui.
            </Text>
            <Text style={styles.subtitle}>
              Descubra, organize e lembre dos livros que importam — tudo em um lugar só.
            </Text>
          </View>

          {/* ── SEARCH ── */}
          <View style={styles.searchCard}>
            <Text style={styles.searchLabel}>Buscar no catálogo</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex.: Machado de Assis"
              placeholderTextColor={TEXT_MUTED}
              value={searchTerm}
              onChangeText={(v) => {
                setSearchTerm(v);
                if (error) setError('');
              }}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            <TouchableOpacity
              style={styles.searchButton}
              onPress={handleSearch}
              activeOpacity={0.8}
            >
              <Text style={styles.searchButtonText}>Explorar</Text>
            </TouchableOpacity>
            {!!error && <Text style={styles.errorText}>{error}</Text>}
          </View>

          {/* ── FEATURES ── */}
          <View style={styles.featuresSection}>
            <Text style={styles.sectionKicker}>O que você encontra</Text>

            {[
              { num: '01', title: 'Busca', desc: 'Pesquise obras pelo catálogo e veja título, autor, capa e descrição.' },
              { num: '02', title: 'Biblioteca', desc: 'Salve livros e mantenha sua estante organizada em um só lugar.' },
              { num: '03', title: 'Avaliação', desc: 'Registre notas e resenhas sobre cada obra que você ler.' },
            ].map((f) => (
              <View key={f.num} style={styles.featureRow}>
                <Text style={styles.featureNum}>{f.num}</Text>
                <View style={styles.featureContent}>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureDesc}>{f.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* ── CTA ── */}
          <View style={styles.ctaSection}>
            <Text style={styles.ctaText}>
              Estamos preparando tudo.{'\n'}
              Enquanto isso, explore o catálogo.
            </Text>
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={() => router.push('/explore' as any)}
              activeOpacity={0.8}
            >
              <Text style={styles.ctaButtonText}>Ver catálogo</Text>
            </TouchableOpacity>
          </View>

          {/* ── FOOTER TAGS ── */}
          <View style={styles.tagsRow}>
            {['Busca de livros', 'Biblioteca pessoal', 'Notas e resenhas'].map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>

        </SafeAreaView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  safe: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  // Hero
  hero: {
    paddingTop: 48,
    paddingBottom: 32,
    gap: 14,
  },
  kicker: {
    color: GOLD,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heading: {
    color: WHITE,
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 38,
  },
  subtitle: {
    color: TEXT_SECONDARY,
    fontSize: 15,
    lineHeight: 23,
    maxWidth: 340,
  },

  // Search card
  searchCard: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(92, 224, 210, 0.16)',
    backgroundColor: 'rgba(9, 13, 18, 0.72)',
    gap: 12,
    marginBottom: 32,
  },
  searchLabel: {
    color: TEXT_MUTED,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(204, 214, 246, 0.15)',
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: WHITE,
    fontSize: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  searchButton: {
    paddingVertical: 13,
    borderRadius: 6,
    backgroundColor: CYAN,
    alignItems: 'center',
  },
  searchButtonText: {
    color: '#0a0e13',
    fontWeight: '800',
    fontSize: 14,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 13,
  },

  // Features
  featuresSection: {
    gap: 12,
    marginBottom: 32,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 28,
  },
  sectionKicker: {
    color: GOLD,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  featureRow: {
    flexDirection: 'row',
    gap: 16,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(204, 214, 246, 0.1)',
    backgroundColor: CARD_BG,
    alignItems: 'flex-start',
  },
  featureNum: {
    color: CYAN,
    fontSize: 12,
    fontWeight: '900',
    width: 24,
    paddingTop: 2,
  },
  featureContent: {
    flex: 1,
    gap: 4,
  },
  featureTitle: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '700',
  },
  featureDesc: {
    color: TEXT_MUTED,
    fontSize: 13,
    lineHeight: 20,
  },

  // CTA
  ctaSection: {
    gap: 16,
    marginBottom: 28,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 28,
  },
  ctaText: {
    color: TEXT_SECONDARY,
    fontSize: 15,
    lineHeight: 23,
  },
  ctaButton: {
    alignSelf: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 6,
    backgroundColor: CYAN,
  },
  ctaButtonText: {
    color: '#0a0e13',
    fontWeight: '800',
    fontSize: 14,
  },

  // Tags
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 8,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(204, 214, 246, 0.1)',
    backgroundColor: 'rgba(17, 24, 32, 0.68)',
  },
  tagText: {
    color: TEXT_SECONDARY,
    fontSize: 12,
    fontWeight: '700',
  },
});
