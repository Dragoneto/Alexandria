import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/services/api';
import { criarAvaliacao } from '@/services/avaliacoes';

const NOTAS = [1, 2, 3, 4, 5];

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export default function AvaliarLivro() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[]; titulo?: string | string[] }>();
  const livroId = firstParam(params.id);
  const titulo = firstParam(params.titulo);
  const [nota, setNota] = useState<number | null>(null);
  const [resenha, setResenha] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [jaAvaliou, setJaAvaliou] = useState(false);
  const submitting = useRef(false);

  const voltarAvaliado = () =>
    router.dismissTo({ pathname: '/livro/[id]', params: { id: livroId, avaliado: '1' } });

  const publicar = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setError('');
    try {
      await criarAvaliacao({ livroId, nota, resenha });
      setSaving(false);
      voltarAvaliado();
    } catch (failure) {
      setSaving(false);
      if (failure instanceof ApiError && failure.status === 409) {
        setJaAvaliou(true);
        return;
      }
      setError(
        failure instanceof Error ? failure.message : 'Não foi possível publicar a avaliação.',
      );
    } finally {
      submitting.current = false;
    }
  };

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Voltar"
              style={[
                styles.backButton,
                { borderColor: theme.border, backgroundColor: theme.backgroundElement },
              ]}>
              <SymbolView
                name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
                size={20}
                tintColor={theme.accent}
              />
            </Pressable>

            <ThemedText themeColor="accent" style={styles.eyebrow}>
              Avaliar
            </ThemedText>
            <ThemedText type="title" style={styles.title}>
              {titulo || 'Este livro'}
            </ThemedText>

            {jaAvaliou ? (
              <ThemedView
                type="backgroundElement"
                style={styles.stateCard}
                accessibilityRole="alert">
                <ThemedText type="subtitle" style={styles.stateTitle}>
                  Você já avaliou este livro
                </ThemedText>
                <ThemedText themeColor="textSecondary">
                  Cada leitor pode deixar uma avaliação por livro.
                </ThemedText>
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={voltarAvaliado}
                  style={[styles.outlineButton, { borderColor: theme.accent }]}>
                  <ThemedText themeColor="accent" style={styles.buttonText}>
                    Voltar ao livro
                  </ThemedText>
                </TouchableOpacity>
              </ThemedView>
            ) : (
              <>
                <ThemedText themeColor="textMuted" style={styles.label}>
                  Sua nota
                </ThemedText>
                <View style={styles.notas} accessibilityRole="radiogroup">
                  {NOTAS.map((valor) => {
                    const ativa = nota === valor;
                    return (
                      <TouchableOpacity
                        key={valor}
                        accessibilityRole="radio"
                        accessibilityLabel={`Nota ${valor} de 5`}
                        accessibilityState={{ selected: ativa }}
                        disabled={saving}
                        onPress={() => setNota(valor)}
                        style={[
                          styles.nota,
                          {
                            borderColor: ativa ? theme.accent : theme.border,
                            backgroundColor: ativa ? theme.accent : 'transparent',
                          },
                        ]}>
                        <ThemedText
                          style={[
                            styles.notaText,
                            { color: ativa ? theme.background : theme.text },
                          ]}>
                          {valor}
                        </ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <ThemedText themeColor="textMuted" style={styles.legend}>
                  1 = não gostei · 5 = adorei
                </ThemedText>

                <ThemedText themeColor="textMuted" style={styles.label}>
                  Sua resenha
                </ThemedText>
                <TextInput
                  accessibilityLabel="Sua resenha"
                  value={resenha}
                  onChangeText={setResenha}
                  editable={!saving}
                  multiline
                  placeholder="O que você achou do livro?"
                  placeholderTextColor={theme.textMuted}
                  style={[styles.resenha, { borderColor: theme.border, color: theme.text }]}
                />

                {!!error && (
                  <ThemedText themeColor="danger" style={styles.error} accessibilityRole="alert">
                    {error}
                  </ThemedText>
                )}

                <TouchableOpacity
                  accessibilityRole="button"
                  disabled={saving}
                  onPress={() => void publicar()}
                  style={[
                    styles.submit,
                    { backgroundColor: theme.accent, opacity: saving ? 0.6 : 1 },
                  ]}>
                  {saving ? (
                    <ActivityIndicator color={theme.background} />
                  ) : (
                    <ThemedText style={[styles.buttonText, { color: theme.background }]}>
                      Publicar avaliação
                    </ThemedText>
                  )}
                </TouchableOpacity>
              </>
            )}
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
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.six,
  },
  backButton: {
    marginTop: Spacing.three,
    width: 44,
    height: 44,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    marginTop: Spacing.four,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: { marginTop: Spacing.one, fontSize: 28, lineHeight: 34 },
  label: {
    marginTop: Spacing.four,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notas: { marginTop: Spacing.two, flexDirection: 'row', gap: Spacing.two },
  nota: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notaText: { fontSize: 17, fontWeight: '800' },
  legend: { marginTop: Spacing.one, fontSize: 12 },
  resenha: {
    marginTop: Spacing.two,
    minHeight: 140,
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
    fontSize: 16,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  error: { marginTop: Spacing.three, fontSize: 13, lineHeight: 20 },
  submit: {
    marginTop: Spacing.four,
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 14, fontWeight: '800' },
  stateCard: { marginTop: Spacing.four, borderRadius: 16, padding: Spacing.four, gap: 8 },
  stateTitle: { fontSize: 18, lineHeight: 26 },
  outlineButton: {
    marginTop: Spacing.two,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
