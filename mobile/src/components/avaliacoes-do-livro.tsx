import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DisabledOpacity } from '@/constants/design-system';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { resumoAvaliacoes, type AvaliacoesDoLivro as Dados } from '@/services/avaliacoes';

type Props = {
  dados: Dados | null;
  carregando: boolean;
  erro: string;
  carregandoMais: boolean;
  erroMais: string;
  onTentarNovamente: () => void;
  onCarregarMais: () => void;
};

function estrelas(nota: number): string {
  return '★'.repeat(nota) + '☆'.repeat(Math.max(0, 5 - nota));
}

export function AvaliacoesDoLivro({
  dados,
  carregando,
  erro,
  carregandoMais,
  erroMais,
  onTentarNovamente,
  onCarregarMais,
}: Props) {
  const theme = useTheme();

  return (
    <View style={styles.section}>
      <ThemedText themeColor="textSecondary" style={styles.sectionLabel}>
        Avaliações
      </ThemedText>

      {carregando && !dados ? (
        <ThemedView
          type="backgroundElement"
          style={styles.stateCard}
          accessibilityLiveRegion="polite">
          <ActivityIndicator accessibilityLabel="Carregando avaliações" color={theme.accent} />
          <ThemedText themeColor="textSecondary">Carregando avaliações…</ThemedText>
        </ThemedView>
      ) : erro ? (
        <ThemedView type="backgroundElement" style={styles.stateCard} accessibilityRole="alert">
          <ThemedText themeColor="textSecondary">{erro}</ThemedText>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={onTentarNovamente}
            style={[styles.outlineButton, { borderColor: theme.accent }]}>
            <ThemedText themeColor="accent" style={styles.buttonText}>
              Tentar novamente
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
      ) : !dados || dados.total === 0 ? (
        <ThemedView type="backgroundElement" style={styles.stateCard}>
          <ThemedText type="subtitle" style={styles.stateTitle}>
            Ainda ninguém avaliou este livro
          </ThemedText>
          <ThemedText themeColor="textSecondary">Que tal ser a primeira pessoa?</ThemedText>
        </ThemedView>
      ) : (
        <>
          <ThemedText style={styles.summary}>
            {resumoAvaliacoes(dados.total, dados.media)}
          </ThemedText>

          {dados.avaliacoes.map((avaliacao) => (
            <ThemedView
              key={avaliacao.id}
              type="backgroundElement"
              style={[
                styles.card,
                { borderColor: avaliacao.minha ? theme.accent : 'transparent' },
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
            </ThemedView>
          ))}

          {dados.hasMore && (
            <TouchableOpacity
              accessibilityRole="button"
              disabled={carregandoMais}
              onPress={onCarregarMais}
              style={[
                styles.outlineButton,
                { borderColor: theme.accent, opacity: carregandoMais ? DisabledOpacity : 1 },
              ]}>
              {carregandoMais ? (
                <ActivityIndicator
                  accessibilityLabel="Carregando mais avaliações"
                  color={theme.accent}
                />
              ) : (
                <ThemedText themeColor="accent" style={styles.buttonText}>
                  Ver mais avaliações
                </ThemedText>
              )}
            </TouchableOpacity>
          )}
          {!!erroMais && (
            <ThemedText themeColor="danger" style={styles.errorText} accessibilityRole="alert">
              {erroMais}
            </ThemedText>
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
