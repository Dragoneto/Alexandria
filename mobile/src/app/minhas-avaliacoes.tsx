import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { FeedbackPressable } from '@/components/feedback-pressable';
import { ThemedView } from '@/components/themed-view';
import { EmptyState } from '@/components/empty_state';
import { ErrorState } from '@/components/error-state';
import { SkeletonList } from '@/components/skeletons';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useLoadingGate } from '@/hooks/use-loading-gate';
import { useVoltar } from '@/hooks/use-voltar';
import { ApiError } from '@/services/api';
import {
  estrelas,
  excluirAvaliacao,
  listarMinhasAvaliacoes,
  type AvaliacaoLida,
} from '@/services/avaliacoes';

function mensagem(error: unknown, padrao: string): string {
  return error instanceof ApiError ? error.message : padrao;
}
type EstadoAvaliacoes = 'loading' | 'success' | 'empty' | 'error';

export default function MinhasAvaliacoes() {
  const theme = useTheme();
  const router = useRouter();
  const voltar = useVoltar('/perfil');
  const [lista, setLista] = useState<AvaliacaoLida[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [estado, setEstado] = useState<EstadoAvaliacoes>('loading');
  const [aviso, setAviso] = useState('');
  const [confirmandoId, setConfirmandoId] = useState<number | null>(null);
  const [excluindoId, setExcluindoId] = useState<number | null>(null);
  const [erroExclusao, setErroExclusao] = useState<{ id: number; texto: string } | null>(null);
  const excluindo = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const showLoading = useLoadingGate(carregando);

  // Recarrega ao ganhar foco: volta da edição com a nota e a resenha novas.
  const carregar = useCallback(async () => {
    controller.current?.abort();
    const atual = new AbortController();
    controller.current = atual;
    await Promise.resolve();
    if (atual.signal.aborted) return;
    try {
      const minhas = await listarMinhasAvaliacoes(atual.signal);
      if (atual.signal.aborted || excluindo.current) return;
      setLista(minhas);
      setErro('');
      setEstado(minhas.length ? 'success' : 'empty');
    } catch (error) {
      if (atual.signal.aborted) return;
      setEstado('error');
      setErro(mensagem(error, 'Não foi possível carregar suas avaliações.'));
    } finally {
      if (!atual.signal.aborted) setCarregando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void carregar();
      return () => controller.current?.abort();
    }, [carregar]),
  );

  const tentarNovamente = () => {
    setCarregando(true);
    setEstado('loading');
    setErro('');
    void carregar();
  };

  const editar = (avaliacao: AvaliacaoLida) => {
    setAviso('');
    router.push({
      pathname: '/avaliar/[id]',
      params: { id: avaliacao.livro.id, titulo: avaliacao.livro.titulo, avaliacaoId: avaliacao.id },
    });
  };

  const excluir = async (avaliacao: AvaliacaoLida) => {
    if (excluindo.current) return;
    // Uma recarga em andamento foi montada antes da exclusão e traria o item de volta.
    controller.current?.abort();
    excluindo.current = true;
    setExcluindoId(avaliacao.id);
    setErroExclusao(null);
    setAviso('');
    try {
      await excluirAvaliacao(avaliacao.id);
      setLista((atuais) => atuais.filter((item) => item.id !== avaliacao.id));
      setEstado(lista.length === 1 ? 'empty' : 'success');
      setAviso(`Avaliação de "${avaliacao.livro.titulo}" excluída.`);
    } catch (error) {
      // 404: já tinha sido excluída em outro aparelho; o resultado para a lista é o mesmo.
      if (error instanceof ApiError && error.status === 404) {
        setLista((atuais) => atuais.filter((item) => item.id !== avaliacao.id));
        setEstado(lista.length === 1 ? 'empty' : 'success');
        setAviso('Esta avaliação já tinha sido excluída.');
      } else {
        setErroExclusao({
          id: avaliacao.id,
          texto: mensagem(error, 'Não foi possível excluir a avaliação.'),
        });
      }
    } finally {
      excluindo.current = false;
      setExcluindoId(null);
      setConfirmandoId(null);
    }
  };

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
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
              Perfil
            </ThemedText>
            <ThemedText type="title" style={styles.title}>
              Minhas avaliações
            </ThemedText>

            {!!aviso && (
              <ThemedText
                themeColor="textSecondary"
                style={styles.aviso}
                accessibilityLiveRegion="polite">
                {aviso}
              </ThemedText>
            )}

            {estado === 'loading' ? (
              showLoading ? (
                <SkeletonList count={3} />
              ) : null
            ) : estado === 'error' ? (
              <ErrorState message={erro} onRetry={tentarNovamente} />
            ) : estado === 'empty' ? (
              <EmptyState
                compact
                title="Suas avaliações aparecerão aqui"
                message="Registre sua opinião sobre um livro para acompanhar suas avaliações e iniciar conversas."
                primaryAction={{ label: 'Explorar livros', onPress: () => router.push('/explore') }}
              />
            ) : (
              <View style={styles.list}>
                <ThemedText themeColor="textSecondary" style={styles.count}>
                  {lista.length === 1 ? '1 avaliação' : `${lista.length} avaliações`}
                </ThemedText>
                {lista.map((avaliacao) => {
                  const ocupado = excluindoId !== null;
                  const confirmando = confirmandoId === avaliacao.id;
                  return (
                    <ThemedView key={avaliacao.id} type="backgroundElement" style={styles.card}>
                      <View style={styles.cardRow}>
                        {avaliacao.livro.capa ? (
                          <Image
                            source={{ uri: avaliacao.livro.capa }}
                            style={[styles.cover, { backgroundColor: theme.backgroundSelected }]}
                            contentFit="cover"
                            accessibilityLabel={`Capa de ${avaliacao.livro.titulo}`}
                          />
                        ) : (
                          <View
                            style={[styles.cover, { backgroundColor: theme.backgroundSelected }]}
                          />
                        )}
                        <View style={styles.cardBody}>
                          <ThemedText style={styles.bookTitle} numberOfLines={2}>
                            {avaliacao.livro.titulo}
                          </ThemedText>
                          <ThemedText
                            themeColor="accent"
                            style={styles.stars}
                            accessibilityLabel={`Nota ${avaliacao.nota} de 5`}>
                            {estrelas(avaliacao.nota)}
                          </ThemedText>
                          {!!avaliacao.resenha && (
                            <ThemedText
                              themeColor="textSecondary"
                              style={styles.resenha}
                              numberOfLines={3}>
                              {avaliacao.resenha}
                            </ThemedText>
                          )}
                        </View>
                      </View>

                      {confirmando ? (
                        <View style={styles.actions}>
                          <ThemedText themeColor="textSecondary" style={styles.confirmText}>
                            Excluir mesmo?
                          </ThemedText>
                          {/* Cancelar fica onde estava o Excluir: um toque duplo não exclui sem querer. */}
                          <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={`Cancelar exclusão da avaliação de ${avaliacao.livro.titulo}`}
                            disabled={ocupado}
                            onPress={() => setConfirmandoId(null)}
                            style={[styles.smallButton, { borderColor: theme.border }]}>
                            <ThemedText themeColor="textSecondary" style={styles.smallButtonText}>
                              Cancelar
                            </ThemedText>
                          </TouchableOpacity>
                          <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={`Confirmar exclusão da avaliação de ${avaliacao.livro.titulo}`}
                            disabled={ocupado}
                            onPress={() => void excluir(avaliacao)}
                            style={[
                              styles.smallButton,
                              { borderColor: theme.danger, opacity: ocupado ? 0.6 : 1 },
                            ]}>
                            {excluindoId === avaliacao.id ? (
                              <ActivityIndicator
                                accessibilityLabel="Excluindo"
                                color={theme.danger}
                              />
                            ) : (
                              <ThemedText themeColor="danger" style={styles.smallButtonText}>
                                Confirmar
                              </ThemedText>
                            )}
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={styles.actions}>
                          <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={`Editar avaliação de ${avaliacao.livro.titulo}`}
                            disabled={ocupado}
                            onPress={() => editar(avaliacao)}
                            style={[styles.smallButton, { borderColor: theme.accent }]}>
                            <ThemedText themeColor="accent" style={styles.smallButtonText}>
                              Editar
                            </ThemedText>
                          </TouchableOpacity>
                          <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={`Excluir avaliação de ${avaliacao.livro.titulo}`}
                            disabled={ocupado}
                            onPress={() => {
                              setErroExclusao(null);
                              setConfirmandoId(avaliacao.id);
                            }}
                            style={[styles.smallButton, { borderColor: theme.danger }]}>
                            <ThemedText themeColor="danger" style={styles.smallButtonText}>
                              Excluir
                            </ThemedText>
                          </TouchableOpacity>
                          {/* Por último, para não mudar a posição do Excluir. */}
                          <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={`Ver a conversa da avaliação de ${avaliacao.livro.titulo}`}
                            disabled={ocupado}
                            onPress={() =>
                              router.push({
                                pathname: '/avaliacao/[id]',
                                params: { id: String(avaliacao.id) },
                              })
                            }
                            style={[styles.smallButton, { borderColor: theme.accent }]}>
                            <ThemedText themeColor="accent" style={styles.smallButtonText}>
                              Ver conversa
                            </ThemedText>
                          </TouchableOpacity>
                        </View>
                      )}

                      {erroExclusao?.id === avaliacao.id && (
                        <ThemedText
                          themeColor="danger"
                          style={styles.errorText}
                          accessibilityRole="alert">
                          {erroExclusao.texto}
                        </ThemedText>
                      )}
                    </ThemedView>
                  );
                })}
              </View>
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
  aviso: { marginTop: Spacing.three, fontSize: 13, lineHeight: 20 },
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
  buttonText: { fontSize: 14, fontWeight: '800' },
  list: { marginTop: Spacing.four, gap: Spacing.three },
  count: { fontSize: 12, fontWeight: '700' },
  card: { borderRadius: 16, padding: Spacing.three, gap: Spacing.three },
  cardRow: { flexDirection: 'row', gap: Spacing.three },
  cover: { width: 56, height: 84, borderRadius: 8 },
  cardBody: { flex: 1, gap: 4 },
  bookTitle: { fontSize: 16, fontWeight: '800' },
  stars: { fontSize: 15, letterSpacing: 2 },
  resenha: { fontSize: 14, lineHeight: 21 },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.two },
  confirmText: { fontSize: 13, fontWeight: '700' },
  smallButton: {
    minWidth: 88,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallButtonText: { fontSize: 13, fontWeight: '800' },
  errorText: { fontSize: 12, lineHeight: 18 },
});
