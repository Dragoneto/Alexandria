import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { BookSearchItem } from '@/services/open-library';

type BookCardProps = {
  book: BookSearchItem;
  onPress: (book: BookSearchItem) => void;
};

/** Card de um resultado da busca: capa, título e autor. O toque abre o detalhe do livro. */
export function BookCard({ book, onPress }: BookCardProps) {
  const theme = useTheme();
  const [coverFailed, setCoverFailed] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ver detalhes de ${book.title}`}
      onPress={() => onPress(book)}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.backgroundElement },
        pressed && styles.cardPressed,
      ]}>
      {book.coverUrl && !coverFailed ? (
        <Image
          source={{ uri: book.coverUrl }}
          style={styles.cover}
          contentFit="contain"
          accessibilityLabel={`Capa de ${book.title}`}
          onError={() => setCoverFailed(true)}
        />
      ) : (
        <View style={[styles.coverPlaceholder, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText themeColor="textMuted" style={styles.coverPlaceholderText}>
            {book.title}
          </ThemedText>
        </View>
      )}
      <View style={styles.cardBody}>
        <View style={styles.categoryBadge}>
          <ThemedText themeColor="accent" style={styles.categoryText}>
            {book.category}
          </ThemedText>
        </View>
        <ThemedText style={styles.cardTitle} numberOfLines={2}>
          {book.title}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.cardAuthor} numberOfLines={2}>
          {book.authors.length ? book.authors.join(', ') : 'Autoria não informada'}
        </ThemedText>
        <ThemedText themeColor="textMuted" style={styles.cardDescription}>
          {book.firstPublishYear
            ? `Primeira publicação: ${book.firstPublishYear}`
            : 'Ano não informado'}
          {' · '}
          {book.editionCount} edição(ões)
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, overflow: 'hidden' },
  cardPressed: { opacity: 0.75 },
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
    backgroundColor: 'rgba(100,255,218,0.08)',
  },
  categoryText: { fontSize: 11, fontWeight: '800' },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  cardAuthor: { fontSize: 13, fontWeight: '700' },
  cardDescription: { fontSize: 13, lineHeight: 20 },
});
