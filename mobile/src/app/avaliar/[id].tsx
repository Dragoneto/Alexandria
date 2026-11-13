import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { FeedbackPressable } from '@/components/feedback-pressable';
import { ThemedView } from '@/components/themed-view';
import { ErrorState } from '@/components/error-state';
import { PopupMarcarLido } from '@/components/popup-marcar-lido';
import { SkeletonReviewForm } from '@/components/skeletons';
import { DisabledOpacity } from '@/constants/design-system';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useFoco } from '@/hooks/use-foco';
import { useTheme } from '@/hooks/use-theme';
import { useLoadingGate } from '@/hooks/use-loading-gate';
import { useVoltar } from '@/hooks/use-voltar';
import { ApiError } from '@/services/api';
import {
  atualizarAvaliacao,
  buscarAvaliacao,
  contarCaracteres,
  criarAvaliacao,
  RESENHA_MAXIMA,
  RESENHA_MINIMA,
  validarAvaliacao,
  type ErrosAvaliacao,
} from '@/services/avaliacoes';
import { livroEstaNaBiblioteca, marcarComoLido } from '@/services/biblioteca';
import { getBookDetail } from '@/services/open-library';

const NOTAS = [1, 2, 3, 4, 5];

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export default function AvaliarLivro() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string | string[];
    titulo?: string | string[];
    avaliacaoId?: string | string[];
  }>();
  const livroId = firstParam(params.id);
  const voltarPara = (livroId ? `/livro/${livroId}` : '/home') as Href;
  const voltar = useVoltar(voltarPara);
  const tituloParam = firstParam(params.titulo);
  // Aberta por link direto (sem ?titulo=), a tela busca o nome do livro em vez de "Este livro".
  const [tituloBuscado, setTituloBuscado] = useState('');
  const titulo = tituloParam || tituloBuscado;
  const avaliacaoParam = firstParam(params.avaliacaoId);
  const avaliacaoId = /^[1-9]\d*$/.test(avaliacaoParam) ? Number(avaliacaoParam) : null;
  const editando = avaliacaoId !== null;
  const [nota, setNota] = useState<number | null>(null);
  const [resenha, setResenha] = useState('');
  const { focado: resenhaFocada, propsDeFoco } = useFoco();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [erros, setErros] = useState<ErrosAvaliacao>({});
  const [jaAvaliou, setJaAvaliou] = useState(false);
  const [carregando, setCarregando] = useState(editando);
  const [erroAoCarregar, setErroAoCarregar] = useState('');
  const [removida, setRemovida] = useState(false);
  const [recarregar, setRecarregar] = useState(0);
  const [sugerirLido, setSugerirLido] = useState(false);
  const [marcandoLido, setMarcandoLido] = useState(false);
  const [erroLido, setErroLido] = useState('');

  useEffect(() => {
    if (tituloParam || !livroId) return;
    const controller = new AbortController();
    getBookDetail(livroId, controller.signal)
      .then((livro) => setTituloBuscado(livro.title))
      .catch(() => {});
    return () => controller.abort();
  }, [livroId, tituloParam]);
  const submitting = useRef(false);
  const tamanho = contarCaracteres(resenha);
  const mostrarSkeleton = useLoadingGate(carregando);

  useEffect(() => {
    if (avaliacaoId === null) return;
    const controller = new AbortController();
    const carregar = async () => {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setCarregando(true);
      setErroAoCarregar('');
      try {
        const atual = await buscarAvaliacao(avaliacaoId, controller.signal);
        setNota(atual.nota);
        setResenha(atual.resenha ?? '');
      } catch (failure) {
        if (controller.signal.aborted) return;
        if (failure instanceof ApiError && failure.status === 404) setRemovida(true);
        else
          setErroAoCarregar(
            failure instanceof Error ? failure.message : 'Não foi possível carregar a avaliação.',
          );
      } finally {
        if (!controller.signal.aborted) setCarregando(false);
      }
    };
    void carregar();
    return () => controller.abort();
  }, [avaliacaoId, recarregar]);

  const voltarAvaliado = () =>
    router.dismissTo({ pathname: '/livro/[id]', params: { id: livroId, avaliado: '1' } });

  const marcarLido = async () => {
    if (marcandoLido) return;
    setMarcandoLido(true);
    setErroLido('');
    try {
      await marcarComoLido(livroId);
      setSugerirLido(false);
      voltarAvaliado();
    } catch (failure) {
      setErroLido(
        failure instanceof Error ? failure.message : 'Não foi possível atualizar a biblioteca.',
      );
    } finally {
      setMarcandoLido(false);
    }
  };

  const fecharSugestao = () => {
    setSugerirLido(false);
    voltarAvaliado();
  };

  const publicar = async () => {
    if (submitting.current) return;
    const locais = validarAvaliacao(nota, resenha);
    setErros(locais);
    setError('');
    if (locais.nota || locais.resenha) return;
    submitting.current = true;
    setSaving(true);
    try {
      if (avaliacaoId !== null) await atualizarAvaliacao(avaliacaoId, { nota, resenha });
      else await criarAvaliacao({ livroId, nota, resenha });
      // Avaliação nova: a coruja só sugere marcar como lido se o livro ainda não está na biblioteca.
      if (!editando) {
        const naBiblioteca = await livroEstaNaBiblioteca(livroId).catch(() => true);
        setSaving(false);
        if (naBiblioteca) voltarAvaliado();
        else setSugerirLido(true);
        return;
      }
      setSaving(false);
      // Na edição volta para quem abriu o formulário (tela do livro ou Minhas avaliações).
      if (router.canGoBack()) router.back();
      else voltarAvaliado();
    } catch (failure) {
      setSaving(false);
      if (!editando && failure instanceof ApiError && failure.status === 409) {
        setJaAvaliou(true);
        return;
      }
      if (editando && failure instanceof ApiError && failure.status === 404) {
        setRemovida(true);
        return;
      }
      const doServidor = failure instanceof ApiError ? failure.fieldErrors : undefined;
      if (doServidor?.nota || doServidor?.resenha) {
        setErros({ nota: doServidor.nota, resenha: doServidor.resenha });
        return;
      }
      setError(
        failure instanceof Error
          ? failure.message
          : editando
            ? 'Não foi possível salvar a avaliação.'
            : 'Não foi possível publicar a avaliação.',
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
            <FeedbackPressable
              onPress={voltar}
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
            </FeedbackPressable>

            <ThemedText themeColor="accent" style={styles.eyebrow}>
              {editando ? 'Editar avaliação' : 'Avaliar'}
            </ThemedText>
            <ThemedText type="title" style={styles.title}>
              {titulo || 'Este livro'}
            </ThemedText>

            {carregando ? (
              mostrarSkeleton ? (
                <SkeletonReviewForm />
              ) : null
            ) : removida ? (
              <ThemedView
                type="backgroundElement"
                style={styles.stateCard}
                accessibilityRole="alert">
                <ThemedText type="subtitle" style={styles.stateTitle}>
                  Esta avaliação não existe mais
                </ThemedText>
                <ThemedText themeColor="textSecondary">
                  Ela pode ter sido excluída em outro aparelho.
                </ThemedText>
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={voltar}
                  style={[styles.outlineButton, { borderColor: theme.accent }]}>
                  <ThemedText themeColor="accent" style={styles.buttonText}>
                    Voltar
                  </ThemedText>
                </TouchableOpacity>
              </ThemedView>
            ) : erroAoCarregar ? (
              <ErrorState
                message={erroAoCarregar}
                onRetry={() => setRecarregar((atual) => atual + 1)}
              />
            ) : jaAvaliou ? (
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
                <ThemedText themeColor="textSecondary" style={styles.label}>
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
                        onPress={() => {
                          setNota(valor);
                          setErros((atuais) => ({ ...atuais, nota: undefined }));
                        }}
                        style={[
                          styles.nota,
                          {
                            borderColor: ativa ? theme.accent : theme.border,
                            backgroundColor: ativa ? theme.accent : 'transparent',
                          },
                          saving && { opacity: DisabledOpacity },
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
                <ThemedText themeColor="textSecondary" style={styles.legend}>
                  1 = não gostei · 5 = adorei
                </ThemedText>
                {!!erros.nota && (
                  <ThemedText
                    themeColor="danger"
                    style={styles.fieldError}
                    accessibilityRole="alert">
                    {erros.nota}
                  </ThemedText>
                )}

                <ThemedText themeColor="textSecondary" style={styles.label}>
                  Sua resenha
                </ThemedText>
                <TextInput
                  {...propsDeFoco}
                  accessibilityLabel="Sua resenha"
                  value={resenha}
                  onChangeText={(texto) => {
                    setResenha(texto);
                    setErros((atuais) => ({ ...atuais, resenha: undefined }));
                  }}
                  editable={!saving}
                  multiline
                  placeholder="O que você achou do livro?"
                  placeholderTextColor={theme.textMuted}
                  style={[
                    styles.resenha,
                    {
                      borderColor: erros.resenha
                        ? theme.danger
                        : resenhaFocada
                          ? theme.accent
                          : theme.border,
                      color: theme.text,
                    },
                    saving && { opacity: DisabledOpacity },
                  ]}
                />
                {erros.resenha ? (
                  <ThemedText
                    themeColor="danger"
                    style={styles.fieldError}
                    accessibilityRole="alert">
                    {erros.resenha}
                  </ThemedText>
                ) : (
                  <ThemedText themeColor="textSecondary" style={styles.counter}>
                    {tamanho < RESENHA_MINIMA
                      ? `Mínimo de ${RESENHA_MINIMA} caracteres`
                      : `${tamanho}/${RESENHA_MAXIMA}`}
                  </ThemedText>
                )}

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
                    { backgroundColor: theme.accent, opacity: saving ? DisabledOpacity : 1 },
                  ]}>
                  {saving ? (
                    <ActivityIndicator color={theme.background} />
                  ) : (
                    <ThemedText style={[styles.buttonText, { color: theme.background }]}>
                      {editando ? 'Salvar alterações' : 'Publicar avaliação'}
                    </ThemedText>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      <PopupMarcarLido
        visible={sugerirLido}
        titulo={titulo}
        salvando={marcandoLido}
        erro={erroLido}
        onMarcar={marcarLido}
        onDepois={fecharSugestao}
      />
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
    // Sem o contorno do navegador: a borda de foco já é do próprio campo.
    outlineWidth: 0,
    outlineStyle: 'solid',
  },
  error: { marginTop: Spacing.three, fontSize: 13, lineHeight: 20 },
  fieldError: { marginTop: Spacing.one, fontSize: 13, lineHeight: 20 },
  counter: { marginTop: Spacing.one, fontSize: 12, textAlign: 'right' },
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
