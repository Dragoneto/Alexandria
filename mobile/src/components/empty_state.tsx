import { Image } from 'expo-image';
import { StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';


import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const ILLUSTRATION = require('@/assets/images/empty_state.png');

type EmptyStateAction = { label: string; onPress: () => void };

type EmptyStateProps = {
    title: string;
    message: string;
    primaryAction?: EmptyStateAction;
    secondaryAction?: EmptyStateAction;
};


export function EmptyState({ title, message, primaryAction, secondaryAction }: EmptyStateProps) {
    const theme = useTheme();
    const { width } = useWindowDimensions();

    // Largura útil = tela (limitada ao conteúdo) menos o padding lateral
    const available = Math.min(width, MaxContentWidth) - Spacing.three * 2;

    const imageSize = Math.max(260, Math.min(available * 0.95, 460));

    return (
        <Animated.View
            entering={FadeInDown.duration(450)}
            style={styles.container}
            accessibilityLiveRegion="polite">
            <Image
                source={ILLUSTRATION}
                style={[styles.illustration, { width: imageSize }]}
                contentFit="contain"
                accessible={false}
            />


            <ThemedText style={styles.title} accessibilityRole="header">
                {title}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.message}>
                {message}
            </ThemedText>

            {(primaryAction || secondaryAction) && (
                <View style={styles.actions}>
                    {primaryAction && (
                        <TouchableOpacity
                            accessibilityRole="button"
                            onPress={primaryAction.onPress}
                            style={[styles.button, { backgroundColor: theme.accent }]}>
                            <ThemedText style={[styles.buttonText, { color: theme.background }]}>
                                {primaryAction.label}
                            </ThemedText>
                        </TouchableOpacity>
                    )}
                    {secondaryAction && (
                        <TouchableOpacity
                            accessibilityRole="button"
                            onPress={secondaryAction.onPress}
                            style={[styles.button, styles.buttonGhost, { borderColor: theme.accent }]}>
                            <ThemedText themeColor="accent" style={styles.buttonText}>
                                {secondaryAction.label}
                            </ThemedText>
                        </TouchableOpacity>
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
        minHeight: 48,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonGhost: { borderWidth: 1 },
    buttonText: { fontSize: 14, fontWeight: '800' },
});
