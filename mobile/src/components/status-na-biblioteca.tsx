import { useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { AcaoNaBiblioteca } from '@/hooks/use-item-da-biblioteca';
import type { BibliotecaItem, StatusLeitura } from '@/services/biblioteca';

const STATUS: { valor: StatusLeitura; rotulo: string }[] = [
  { valor: 'QUERO_LER', rotulo: 'Quero ler' },
  { valor: 'LENDO', rotulo: 'Lendo' },
  { valor: 'LIDO', rotulo: 'Lido' },
  { valor: 'ABANDONADO', rotulo: 'Abandonado' },
];

type Props = {
  item: BibliotecaItem | null;
  carregando: boolean;
  erro: string;
  salvando: AcaoNaBiblioteca | null;
  erroAcao: string;
  onTentarNovamente: () => void;
  onAdicionar: () => void;
  onTrocarStatus: (status: StatusLeitura) => void;
  onRemover: () => void;
};

export function StatusNaBiblioteca({
  item,
  carregando,
  erro,
  salvando,
  erroAcao,
  onTentarNovamente,
  onAdicionar,
  onTrocarStatus,
  onRemover,
}: Props) {
  const theme = useTheme();
  // Guarda o id do item: se ele sair e voltar, a confirmação não reaparece aberta.
  const [confirmandoId, setConfirmandoId] = useState<number | null>(null);
  const confirmando = item !== null && confirmandoId === item.id;
  const setConfirmando = (aberta: boolean) => setConfirmandoId(aberta && item ? item.id : null);
  const ocupado = salvando !== null;

  if (carregando) {
    return (
      <View
        style={[styles.primaryButton, { backgroundColor: theme.accent, opacity: 0.6 }]}
        accessibilityLiveRegion="polite">
        <ThemedText style={[styles.buttonText, { color: theme.background }]}>
          Verificando sua biblioteca…
        </ThemedText>
      </View>
    );
  }

  if (erro) {
    return (
      <ThemedView type="backgroundElement" style={styles.card} accessibilityRole="alert">
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
    );
  }

  const erroVisivel = !!erroAcao && (
    <ThemedText themeColor="danger" style={styles.errorText} accessibilityRole="alert">
      {erroAcao}
    </ThemedText>
  );

  if (!item) {
    return (
      <>
        <TouchableOpacity
          accessibilityRole="button"
          disabled={ocupado}
          onPress={onAdicionar}
          style={[
            styles.primaryButton,
            { backgroundColor: theme.accent, opacity: ocupado ? 0.6 : 1 },
          ]}>
          {salvando === 'adicionar' ? (
            <ActivityIndicator accessibilityLabel="Adicionando" color={theme.background} />
          ) : (
            <ThemedText style={[styles.buttonText, { color: theme.background }]}>
              Adicionar à biblioteca
            </ThemedText>
          )}
        </TouchableOpacity>
        {erroVisivel}
      </>
    );
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText themeColor="textSecondary" style={styles.label}>
        Status de leitura na sua biblioteca
      </ThemedText>
      <View
        style={styles.chips}
        accessibilityRole="radiogroup"
        accessibilityLabel="Status de leitura">
        {STATUS.map(({ valor, rotulo }) => {
          const ativo = item.statusLeitura === valor;
          return (
            <TouchableOpacity
              key={valor}
              accessibilityRole="radio"
              accessibilityState={{ checked: ativo, disabled: ocupado }}
              aria-checked={ativo}
              accessibilityLabel={rotulo}
              disabled={ocupado}
              onPress={() => onTrocarStatus(valor)}
              style={[
                styles.chip,
                {
                  borderColor: ativo ? theme.accent : theme.border,
                  opacity: ocupado && !ativo ? 0.6 : 1,
                },
              ]}>
              <ThemedText themeColor={ativo ? 'accent' : 'textSecondary'} style={styles.chipText}>
                {rotulo}
              </ThemedText>
            </TouchableOpacity>
          );
        })}
      </View>
      {salvando === 'status' && (
        <ThemedText themeColor="textSecondary" style={styles.hint} accessibilityLiveRegion="polite">
          Salvando…
        </ThemedText>
      )}
      {erroVisivel}

      {confirmando ? (
        <View style={styles.confirmRow}>
          <ThemedText themeColor="textSecondary" style={styles.confirmText}>
            Remover mesmo?
          </ThemedText>
          <TouchableOpacity
            accessibilityRole="button"
            disabled={ocupado}
            onPress={() => {
              setConfirmando(false);
              onRemover();
            }}
            style={[styles.smallButton, { borderColor: theme.danger }]}>
            <ThemedText themeColor="danger" style={styles.smallButtonText}>
              Confirmar
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => setConfirmando(false)}
            style={[styles.smallButton, { borderColor: theme.border }]}>
            <ThemedText themeColor="textSecondary" style={styles.smallButtonText}>
              Cancelar
            </ThemedText>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          accessibilityRole="button"
          disabled={ocupado}
          onPress={() => setConfirmando(true)}
          style={{ opacity: ocupado ? 0.6 : 1 }}>
          <ThemedText themeColor="danger" style={styles.removeText}>
            {salvando === 'remover' ? 'Removendo…' : 'Remover da biblioteca'}
          </ThemedText>
        </TouchableOpacity>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  primaryButton: {
    marginTop: Spacing.four,
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 14, fontWeight: '800' },
  card: { marginTop: Spacing.four, borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  label: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: '700' },
  hint: { fontSize: 12 },
  errorText: { marginTop: Spacing.two, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  outlineButton: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.two },
  confirmText: { fontSize: 13, fontWeight: '700' },
  smallButton: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  smallButtonText: { fontSize: 13, fontWeight: '800' },
  removeText: { fontSize: 13, fontWeight: '800', paddingVertical: Spacing.one },
});
