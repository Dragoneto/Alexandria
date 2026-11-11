import { Image } from 'expo-image';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import type { ReactNode } from 'react';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { ActionButton } from '@/components/action-button';
import { FeedbackPressable } from '@/components/feedback-pressable';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const ILLUSTRATION = require('@/assets/images/empty_state.png');

type EmptyStateAction = { label: string; onPress: () => void };

type EmptyStateProps = {
  title: string;
  message: string;
  primaryAction?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  illustration?: ReactNode;
  compact?: boolean;
};

export function EmptyState({
  title,
  message,
  primaryAction,
  secondaryAction,
  illustration,
  compact = false,
}: EmptyStateProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  // Largura útil = tela (limitada ao conteúdo) menos o padding lateral
  const available = Math.min(width, MaxContentWidth) - Spacing.three * 2;

  const imageSize = compact ? 64 : Math.max(260, Math.min(available * 0.95, 460));

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.duration(450)}
      style={[styles.container, compact && styles.compactContainer]}
      accessibilityLiveRegion="polite">
      {illustration ?? (
        <Image
          source={ILLUSTRATION}
          style={[styles.illustration, { width: imageSize }, compact && styles.compactIllustration]}
          contentFit="contain"
          accessible={false}
        />
      )}

      <ThemedText style={styles.title} accessibilityRole="header">
        {title}
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.message}>
        {message}
      </ThemedText>

      {(primaryAction || secondaryAction) && (
        <View style={styles.actions}>
          {primaryAction && (
            <ActionButton label={primaryAction.label} onPress={primaryAction.onPress} />
          )}
          {secondaryAction && (
            <FeedbackPressable
              accessibilityRole="button"
              accessibilityLabel={secondaryAction.label}
              onPress={secondaryAction.onPress}
              style={[styles.button, styles.buttonGhost, { borderColor: theme.accent }]}>
              <ThemedText themeColor="accent" style={styles.buttonText}>
                {secondaryAction.label}
              </ThemedText>
            </FeedbackPressable>
          )}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.five,
    alignItems: 'center',
    paddingVertical: Spacing.four,
  },
  compactContainer: { marginTop: 0, paddingVertical: 0 },
  compactIllustration: { height: 64 },
  illustrationBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
    borderRadius: 28,
    borderWidth: 4,
    backgroundColor: 'none',
  },
  illustration: { aspectRatio: 673 / 533 },

  title: {
    marginTop: Spacing.four,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  message: {
    marginTop: Spacing.two,
    maxWidth: 360,
    lineHeight: 22,
    textAlign: 'center',
  },
  actions: {
    marginTop: Spacing.four,
    width: '100%',
    maxWidth: 320,
    gap: Spacing.two,
  },
  button: {
    minHeight: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonGhost: { borderWidth: 1 },
  buttonText: { fontSize: 14, fontWeight: '800' },
});
