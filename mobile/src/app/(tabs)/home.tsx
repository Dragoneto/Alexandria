import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
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
import { getProfile, getProfilePhoto } from '@/services/auth';
import { searchBooks, type BookSearchItem } from '@/services/open-library';

const COVER_WIDTH = 112;
const COVER_HEIGHT = 168; // proporção 2:3, a de uma capa de verdade

// `category` precisa ser uma das aceitas pelo backend:
// Fantasia, Romance, História, Tecnologia, Biografia, Mistério.
const ESTANTES = [
  { title: 'Machado de Assis', query: 'Machado de Assis' },
  { title: 'Fantasia', query: 'magic', category: 'Fantasia' },
  { title: 'Mistério', query: 'detective', category: 'Mistério' },
  { title: 'Biografias', query: 'life', category: 'Biografia' },
];

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
  const [firstName, setFirstName] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);

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

  const handleSearch = () => {
    const normalized = searchTerm.trim();
    if (!normalized) return;
    router.push(`/explore?q=${encodeURIComponent(normalized)}` as Href);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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

        <View style={styles.search}>
          <SymbolView
            name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
            size={18}
            tintColor={TextColor.secondary}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar livros ou autores"
            placeholderTextColor={TextColor.muted}
            value={searchTerm}
            onChangeText={setSearchTerm}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            selectionColor={Mint.mint400}
          />
        </View>

        {ESTANTES.map((estante) => (
          <Estante key={estante.title} {...estante} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

type EstanteProps = {
  title: string;
  query: string;
  category?: string;
};

/** Estante horizontal de capas. Some sozinha se a busca falhar ou vier vazia. */
function Estante({ title, query, category }: EstanteProps) {
  const router = useRouter();
  const [books, setBooks] = useState<BookSearchItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    searchBooks({ query, category, quality: 'curated', limit: 12, signal: controller.signal })
      .then((result) => setBooks(result.books))
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [query, category]);

  if (failed || books?.length === 0) return null;

  return (
    <View style={styles.shelf}>
      <Text style={styles.shelfTitle}>{title}</Text>

      {books ? (
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
      ) : (
        <View style={[styles.shelfRow, styles.skeletonRow]}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.skeleton} />
          ))}
        </View>
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
  },
  searchInput: {
    flex: 1,
    fontFamily: DSFonts.ui,
    fontSize: 16,
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
  skeletonRow: {
    flexDirection: 'row',
  },
  skeleton: {
    width: COVER_WIDTH,
    height: COVER_HEIGHT,
    borderRadius: Radius.cover,
    backgroundColor: Ink.ink700,
  },
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
