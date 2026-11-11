import { StyleSheet, View } from 'react-native';

import { ActionButton } from '@/components/action-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

type Props = {
  title?: string;
  message: string;
  onRetry: () => void;
  retryLabel?: string;
};

export function ErrorState({
  title = 'Não foi possível carregar',
  message,
  onRetry,
  retryLabel = 'Tentar novamente',
}: Props) {
  return (
    <ThemedView type="backgroundElement" style={styles.card} accessibilityRole="alert">
      <View style={styles.copy}>
        <ThemedText type="subtitle">{title}</ThemedText>
        <ThemedText themeColor="textSecondary">{message}</ThemedText>
      </View>
      <ActionButton label={retryLabel} variant="ghost" onPress={onRetry} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: Spacing.four, gap: Spacing.three },
  copy: { gap: Spacing.two },
});
