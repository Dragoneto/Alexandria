import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty_state';
import { ErrorState } from '@/components/error-state';
import { SkeletonList } from '@/components/skeletons';
import { FeedbackPressable } from '@/components/feedback-pressable';
import { ThemedText } from '@/components/themed-text';
import { DisabledOpacity } from '@/constants/design-system';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useLoadingGate } from '@/hooks/use-loading-gate';
import { estrelas, resumoAvaliacoes, type AvaliacoesDoLivro as Dados } from '@/services/avaliacoes';

type Props = {
  dados: Dados | null;
  status: 'loading' | 'success' | 'empty' | 'error';
  carregando: boolean;
  erro: string;
  carregandoMais: boolean;
  erroMais: string;
  onTentarNovamente: () => void;
  onCarregarMais: () => void;
  onEscreverAvaliacao: () => void;
};

export function AvaliacoesDoLivro({
  dados,
  status,
  carregando,
  erro,
  carregandoMais,
  erroMais,
  onTentarNovamente,
  onCarregarMais,
  onEscreverAvaliacao,
}: Props) {
  const theme = useTheme();
  const router = useRouter();
  const showLoading = useLoadingGate(status === 'loading');

  return (
    <View style={styles.section}>
      <ThemedText themeColor="textSecondary" style={styles.sectionLabel}>
        Avaliações
      </ThemedText>

      {status === 'loading' ? (
        showLoading ? (
          <SkeletonList count={2} />
        ) : null
      ) : status === 'error' ? (
        <ErrorState message={erro} onRetry={onTentarNovamente} loading={carregando} />
      ) : status === 'empty' || !dados ? (
        <EmptyState
          compact
          title="Nenhuma avaliação ainda"
          message="Conte o que achou do livro para ajudar outros leitores."
          primaryAction={{ label: 'Avaliar este livro', onPress: onEscreverAvaliacao }}
        />
      ) : (
        <>
          <ThemedText style={styles.summary}>
            {resumoAvaliacoes(dados.total, dados.media)}
          </ThemedText>

          {dados.avaliacoes.map((avaliacao) => (
            <FeedbackPressable
              key={avaliacao.id}
              accessibilityRole="button"
              accessibilityLabel={`Abrir a conversa da avaliação de ${avaliacao.usuarioNome || 'Leitor'}`}
              onPress={() =>
                router.push({ pathname: '/avaliacao/[id]', params: { id: String(avaliacao.id) } })
              }
              style={[
                styles.card,
                {
                  backgroundColor: theme.backgroundElement,
                  borderColor: avaliacao.minha ? theme.accent : 'transparent',
                },
              ]}>
              <View style={styles.cardHeader}>
                <ThemedText style={styles.author} numberOfLines={1}>
                  {avaliacao.usuarioNome || 'Leitor'}
                </ThemedText>
                {avaliacao.minha && (
                  <ThemedText themeColor="accent" style={styles.badge}>
                    Sua avaliação
                  </ThemedText>
                )}
              </View>
              <ThemedText
                themeColor="accent"
                style={styles.stars}
                accessibilityLabel={`Nota ${avaliacao.nota} de 5`}>
                {estrelas(avaliacao.nota)}
              </ThemedText>
              {!!avaliacao.resenha && (
                <ThemedText themeColor="textSecondary" style={styles.resenha}>
                  {avaliacao.resenha}
                </ThemedText>
              )}
            </FeedbackPressable>
          ))}

          {dados.hasMore && (
            <FeedbackPressable
              accessibilityRole="button"
              accessibilityLabel="Carregar mais avaliações"
              disabled={carregandoMais}
              loading={carregandoMais}
              loadingColor={theme.accent}
              onPress={onCarregarMais}
              style={[
                styles.outlineButton,
                { borderColor: theme.accent, opacity: carregandoMais ? DisabledOpacity : 1 },
              ]}>
              {!carregandoMais && (
                <ThemedText themeColor="accent" style={styles.buttonText}>
                  Ver mais avaliações
                </ThemedText>
              )}
            </FeedbackPressable>
          )}
          {!!erroMais && (
            <ErrorState
              title="Não foi possível carregar mais avaliações"
              message={erroMais}
              onRetry={onCarregarMais}
              loading={carregandoMais}
            />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: Spacing.four, gap: Spacing.two },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stateCard: { borderRadius: 16, padding: Spacing.four, gap: 8 },
  stateTitle: { fontSize: 18, lineHeight: 26 },
  summary: { fontSize: 15, fontWeight: '800' },
  card: { borderRadius: 16, borderWidth: 1, padding: Spacing.three, gap: 6 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  author: { flexShrink: 1, fontSize: 15, fontWeight: '800' },
  badge: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  stars: { fontSize: 16, letterSpacing: 2 },
  resenha: { fontSize: 14, lineHeight: 21 },
  outlineButton: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 14, fontWeight: '800' },
  errorText: { fontSize: 13, lineHeight: 20, textAlign: 'center' },
});
