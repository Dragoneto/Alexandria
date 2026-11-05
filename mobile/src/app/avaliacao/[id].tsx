import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  type TextInputInstance,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DisabledOpacity } from '@/constants/design-system';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useConversa } from '@/hooks/use-conversa';
import { useFoco } from '@/hooks/use-foco';
import { useTheme } from '@/hooks/use-theme';
import { contarCaracteres, limparResenha } from '@/services/avaliacoes';
import {
  classificarFalhaComentario,
  comentar,
  editarComentario,
  excluirComentario,
  mensagemDeFalhaComentario,
  montarConversa,
  recuoVisual,
  responder,
  TEXTO_COMENTARIO_MAXIMO,
  type Comentario,
} from '@/services/comentarios';

type Modo =
  | { tipo: 'comentar' }
  | { tipo: 'responder'; alvo: Comentario }
  | { tipo: 'editar'; alvo: Comentario };

const RECUO = 16;

function estrelas(nota: number): string {
  return '★'.repeat(nota) + '☆'.repeat(Math.max(0, 5 - nota));
}

function primeiroParam(valor: string | string[] | undefined): string {
  return Array.isArray(valor) ? (valor[0] ?? '') : (valor ?? '');
}

export default function ConversaDaAvaliacao() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const textoId = primeiroParam(params.id);
  const avaliacaoId = /^[1-9]\d*$/.test(textoId) ? Number(textoId) : 0;
  const conversa = useConversa(avaliacaoId);
  const itens = useMemo(() => montarConversa(conversa.comentarios ?? []), [conversa.comentarios]);

  const { focado, propsDeFoco } = useFoco();
  const campo = useRef<TextInputInstance>(null);
  const [texto, setTexto] = useState('');
  const [modo, setModo] = useState<Modo>({ tipo: 'comentar' });
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState('');
  const [aviso, setAviso] = useState('');
  const [confirmandoId, setConfirmandoId] = useState<number | null>(null);
  const [excluindoId, setExcluindoId] = useState<number | null>(null);
  const ocupado = useRef(false);
  const confirmacaoPronta = useRef(false);
  // Rascunho guardado enquanto a pessoa edita outro comentário.
  const rascunho = useRef('');

  const travado = enviando || excluindoId !== null;
  const tamanho = contarCaracteres(texto);
  const podeEnviar = tamanho > 0 && tamanho <= TEXTO_COMENTARIO_MAXIMO && !travado;

  // Se o alvo da resposta ou da edição sumir numa atualização, volta para comentário novo.
  const tipoModo = modo.tipo;
  const alvoId = modo.tipo === 'comentar' ? null : modo.alvo.id;
  useEffect(() => {
    if (alvoId === null || !conversa.comentarios) return;
    const alvo = conversa.comentarios.find((comentario) => comentario.id === alvoId);
    if (alvo && !alvo.removido) return;
    if (tipoModo === 'editar') setTexto(rascunho.current);
    setModo({ tipo: 'comentar' });
    setErroEnvio('Esse comentário foi removido. Seu texto continua aqui.');
  }, [alvoId, tipoModo, conversa.comentarios]);

  const voltar = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/home');
  };

  const focarCampo = () => setTimeout(() => campo.current?.focus(), 0);

  const iniciarResposta = (alvo: Comentario) => {
    if (travado) return;
    if (modo.tipo === 'editar') setTexto(rascunho.current);
    setModo({ tipo: 'responder', alvo });
    setErroEnvio('');
    setConfirmandoId(null);
    focarCampo();
  };

  const iniciarEdicao = (alvo: Comentario) => {
    if (travado) return;
    if (modo.tipo !== 'editar') rascunho.current = texto;
    setModo({ tipo: 'editar', alvo });
    setTexto(alvo.texto ?? '');
    setErroEnvio('');
    setConfirmandoId(null);
    focarCampo();
  };

  const cancelarModo = () => {
    if (modo.tipo === 'editar') setTexto(rascunho.current);
    setModo({ tipo: 'comentar' });
    setErroEnvio('');
  };

  const enviar = async () => {
    if (ocupado.current || !podeEnviar) return;
    ocupado.current = true;
    setEnviando(true);
    setErroEnvio('');
    setAviso('');
    const limpo = limparResenha(texto);
    try {
      if (modo.tipo === 'editar') await editarComentario(modo.alvo.id, limpo);
      else if (modo.tipo === 'responder') await responder(avaliacaoId, modo.alvo.id, limpo);
      else await comentar(avaliacaoId, limpo);
      setAviso(modo.tipo === 'editar' ? 'Comentário atualizado.' : 'Comentário enviado.');
      setTexto(modo.tipo === 'editar' ? rascunho.current : '');
      rascunho.current = '';
      setModo({ tipo: 'comentar' });
      void conversa.recarregar();
    } catch (error) {
      setErroEnvio(mensagemDeFalhaComentario(error));
      // O alvo sumiu: o texto fica no campo para virar um comentário novo.
      if (classificarFalhaComentario(error) === 'removido') {
        if (modo.tipo === 'editar') setTexto(rascunho.current);
        setModo({ tipo: 'comentar' });
        void conversa.recarregar();
      }
    } finally {
      ocupado.current = false;
      setEnviando(false);
    }
  };

  const excluir = async (alvo: Comentario) => {
    // Ignora o segundo toque de um toque duplo no Excluir.
    if (ocupado.current || !confirmacaoPronta.current) return;
    ocupado.current = true;
    setExcluindoId(alvo.id);
    setErroEnvio('');
    setAviso('');
    try {
      await excluirComentario(alvo.id);
      setAviso('Comentário excluído.');
    } catch (error) {
      if (classificarFalhaComentario(error) !== 'removido') {
        setErroEnvio(mensagemDeFalhaComentario(error));
      }
    } finally {
      ocupado.current = false;
      setExcluindoId(null);
      setConfirmandoId(null);
      if (modo.tipo !== 'comentar' && modo.alvo.id === alvo.id) cancelarModo();
      void conversa.recarregar();
    }
  };

  const avaliacao = conversa.avaliacao;
  const carregandoInicio = conversa.carregando && !avaliacao;

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.safe}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled">
            <View style={styles.content}>
              <Pressable
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
              </Pressable>

              {conversa.inexistente ? (
                <ThemedView
                  type="backgroundElement"
                  style={styles.stateCard}
                  accessibilityRole="alert">
                  <ThemedText type="subtitle" style={styles.stateTitle}>
                    Avaliação não encontrada
                  </ThemedText>
                  <ThemedText themeColor="textSecondary">
                    Ela pode ter sido apagada pelo autor.
                  </ThemedText>
                </ThemedView>
              ) : carregandoInicio ? (
                <ThemedView
                  type="backgroundElement"
                  style={styles.stateCard}
                  accessibilityLiveRegion="polite">
                  <ActivityIndicator
                    accessibilityLabel="Carregando conversa"
                    color={theme.accent}
                  />
                  <ThemedText themeColor="textSecondary">Carregando conversa…</ThemedText>
                </ThemedView>
              ) : !avaliacao ? (
                <ThemedView
                  type="backgroundElement"
                  style={styles.stateCard}
                  accessibilityRole="alert">
                  <ThemedText themeColor="textSecondary">{conversa.erro}</ThemedText>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Tentar carregar de novo"
                    onPress={() => void conversa.recarregar()}
                    style={[styles.outlineButton, { borderColor: theme.accent }]}>
                    <ThemedText themeColor="accent" style={styles.buttonText}>
                      Tentar novamente
                    </ThemedText>
                  </TouchableOpacity>
                </ThemedView>
              ) : (
                <>
                  <ThemedView type="backgroundElement" style={styles.reviewCard}>
                    <ThemedText themeColor="textSecondary" style={styles.bookTitle}>
                      {avaliacao.livro.titulo}
                    </ThemedText>
                    <ThemedText style={styles.author}>
                      {avaliacao.usuarioNome || 'Leitor'}
                      {avaliacao.minha ? ' (você)' : ''}
                    </ThemedText>
                    <ThemedText
                      themeColor="accent"
                      style={styles.stars}
                      accessibilityLabel={`Nota ${avaliacao.nota} de 5`}>
                      {estrelas(avaliacao.nota)}
                    </ThemedText>
                    {!!avaliacao.resenha && (
                      <ThemedText style={styles.resenha}>{avaliacao.resenha}</ThemedText>
                    )}
                  </ThemedView>

                  <View style={styles.conversaHeader}>
                    <ThemedText type="subtitle" style={styles.conversaTitle}>
                      Conversa
                    </ThemedText>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Atualizar conversa"
                      disabled={conversa.carregando}
                      onPress={() => void conversa.recarregar()}
                      style={[
                        styles.smallButton,
                        {
                          borderColor: theme.border,
                          opacity: conversa.carregando ? DisabledOpacity : 1,
                        },
                      ]}>
                      <ThemedText themeColor="accent" style={styles.smallButtonText}>
                        {conversa.carregando ? 'Atualizando…' : 'Atualizar'}
                      </ThemedText>
                    </TouchableOpacity>
                  </View>

                  {!!conversa.erro && (
                    <ThemedText
                      themeColor="danger"
                      style={styles.errorText}
                      accessibilityRole="alert">
                      {conversa.erro}
                    </ThemedText>
                  )}

                  {itens.length === 0 ? (
                    <ThemedView type="backgroundElement" style={styles.stateCard}>
                      <ThemedText themeColor="textSecondary">
                        Ninguém comentou ainda. Comece a conversa.
                      </ThemedText>
                    </ThemedView>
                  ) : (
                    itens.map(({ comentario, nivel, respondendoA }) => {
                      const confirmando = confirmandoId === comentario.id;
                      const excluindo = excluindoId === comentario.id;
                      const nome = comentario.autor.nome || 'Leitor';
                      return (
                        <ThemedView
                          key={comentario.id}
                          type="backgroundElement"
                          style={[
                            styles.comentario,
                            nivel > 0 && {
                              borderLeftColor: theme.accent,
                              borderLeftWidth: 2,
                            },
                            { marginLeft: recuoVisual(nivel) * RECUO },
                          ]}>
                          {respondendoA && (
                            <ThemedText themeColor="textSecondary" style={styles.respondendoA}>
                              Resposta a {respondendoA}
                            </ThemedText>
                          )}
                          {comentario.removido ? (
                            <ThemedText themeColor="textSecondary" style={styles.removido}>
                              Comentário removido
                            </ThemedText>
                          ) : (
                            <>
                              <ThemedText style={styles.comentarioAutor}>{nome}</ThemedText>
                              <ThemedText style={styles.comentarioTexto}>
                                {comentario.texto}
                              </ThemedText>
                              {comentario.atualizadoEm !== comentario.criadoEm && (
                                <ThemedText themeColor="textSecondary" style={styles.editado}>
                                  editado
                                </ThemedText>
                              )}

                              {confirmando ? (
                                <View style={styles.acoes}>
                                  <ThemedText style={styles.confirmText}>Excluir mesmo?</ThemedText>
                                  <TouchableOpacity
                                    accessibilityRole="button"
                                    accessibilityLabel={`Confirmar exclusão do comentário de ${nome}`}
                                    disabled={excluindo}
                                    onPress={() => void excluir(comentario)}
                                    style={[
                                      styles.smallButton,
                                      {
                                        borderColor: theme.danger,
                                        opacity: excluindo ? DisabledOpacity : 1,
                                      },
                                    ]}>
                                    {excluindo ? (
                                      <ActivityIndicator
                                        accessibilityLabel="Excluindo comentário"
                                        color={theme.danger}
                                      />
                                    ) : (
                                      <ThemedText
                                        themeColor="danger"
                                        style={styles.smallButtonText}>
                                        Confirmar
                                      </ThemedText>
                                    )}
                                  </TouchableOpacity>
                                  {/* Cancelar por último: fica mais perto de onde estava o Excluir. */}
                                  <TouchableOpacity
                                    accessibilityRole="button"
                                    accessibilityLabel="Cancelar exclusão"
                                    disabled={excluindo}
                                    onPress={() => setConfirmandoId(null)}
                                    style={[styles.smallButton, { borderColor: theme.border }]}>
                                    <ThemedText
                                      themeColor="textSecondary"
                                      style={styles.smallButtonText}>
                                      Cancelar
                                    </ThemedText>
                                  </TouchableOpacity>
                                </View>
                              ) : (
                                <View style={styles.acoes}>
                                  <TouchableOpacity
                                    accessibilityRole="button"
                                    accessibilityLabel={`Responder a ${nome}`}
                                    disabled={travado}
                                    onPress={() => iniciarResposta(comentario)}
                                    style={[styles.smallButton, { borderColor: theme.border }]}>
                                    <ThemedText themeColor="accent" style={styles.smallButtonText}>
                                      Responder
                                    </ThemedText>
                                  </TouchableOpacity>
                                  {comentario.podeEditar && (
                                    <TouchableOpacity
                                      accessibilityRole="button"
                                      accessibilityLabel="Editar seu comentário"
                                      disabled={travado}
                                      onPress={() => iniciarEdicao(comentario)}
                                      style={[styles.smallButton, { borderColor: theme.border }]}>
                                      <ThemedText
                                        themeColor="accent"
                                        style={styles.smallButtonText}>
                                        Editar
                                      </ThemedText>
                                    </TouchableOpacity>
                                  )}
                                  {comentario.podeExcluir && (
                                    <TouchableOpacity
                                      accessibilityRole="button"
                                      accessibilityLabel="Excluir seu comentário"
                                      disabled={travado}
                                      onPress={() => {
                                        confirmacaoPronta.current = false;
                                        setTimeout(() => (confirmacaoPronta.current = true), 500);
                                        setConfirmandoId(comentario.id);
                                      }}
                                      style={[styles.smallButton, { borderColor: theme.border }]}>
                                      <ThemedText
                                        themeColor="danger"
                                        style={styles.smallButtonText}>
                                        Excluir
                                      </ThemedText>
                                    </TouchableOpacity>
                                  )}
                                </View>
                              )}
                            </>
                          )}
                        </ThemedView>
                      );
                    })
                  )}
                </>
              )}
            </View>
          </ScrollView>

          {!!avaliacao && !conversa.inexistente && (
            <ThemedView
              type="backgroundElement"
              style={[styles.composer, { borderTopColor: theme.border }]}>
              <View style={styles.composerInner}>
                {modo.tipo !== 'comentar' && (
                  <View style={styles.modoRow}>
                    <ThemedText
                      themeColor="textSecondary"
                      style={styles.modoText}
                      numberOfLines={1}>
                      {modo.tipo === 'responder'
                        ? `Respondendo a ${modo.alvo.autor.nome || 'Leitor'}`
                        : 'Editando seu comentário'}
                    </ThemedText>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={
                        modo.tipo === 'responder' ? 'Cancelar resposta' : 'Cancelar edição'
                      }
                      disabled={enviando}
                      onPress={cancelarModo}
                      style={[styles.smallButton, { borderColor: theme.border }]}>
                      <ThemedText themeColor="textSecondary" style={styles.smallButtonText}>
                        Cancelar
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                )}

                {!!erroEnvio && (
                  <ThemedText
                    themeColor="danger"
                    style={styles.errorText}
                    accessibilityRole="alert">
                    {erroEnvio}
                  </ThemedText>
                )}
                <ThemedText
                  themeColor="textSecondary"
                  style={styles.avisoText}
                  accessibilityLiveRegion="polite">
                  {aviso}
                </ThemedText>

                <View style={styles.inputRow}>
                  <TextInput
                    ref={campo}
                    accessibilityLabel={
                      modo.tipo === 'responder'
                        ? `Resposta para ${modo.alvo.autor.nome || 'Leitor'}`
                        : modo.tipo === 'editar'
                          ? 'Editar comentário'
                          : 'Escrever comentário'
                    }
                    placeholder={
                      modo.tipo === 'responder' ? 'Escreva sua resposta' : 'Escreva um comentário'
                    }
                    placeholderTextColor={theme.textMuted}
                    value={texto}
                    onChangeText={(valor) => {
                      setTexto(valor);
                      if (aviso) setAviso('');
                    }}
                    editable={!enviando}
                    multiline
                    maxLength={TEXTO_COMENTARIO_MAXIMO}
                    style={[
                      styles.input,
                      {
                        borderColor: focado ? theme.accent : theme.border,
                        color: theme.text,
                      },
                    ]}
                    {...propsDeFoco}
                  />
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={
                      modo.tipo === 'editar' ? 'Salvar comentário' : 'Enviar comentário'
                    }
                    aria-disabled={!podeEnviar}
                    aria-busy={enviando}
                    disabled={!podeEnviar}
                    onPress={() => void enviar()}
                    style={[
                      styles.sendButton,
                      { backgroundColor: theme.accent, opacity: podeEnviar ? 1 : DisabledOpacity },
                    ]}>
                    {enviando ? (
                      <ActivityIndicator accessibilityLabel="Enviando" color={theme.background} />
                    ) : (
                      <ThemedText style={[styles.sendText, { color: theme.background }]}>
                        {modo.tipo === 'editar' ? 'Salvar' : 'Enviar'}
                      </ThemedText>
                    )}
                  </TouchableOpacity>
                </View>
                <ThemedText themeColor="textSecondary" style={styles.contador}>
                  {tamanho}/{TEXTO_COMENTARIO_MAXIMO}
                </ThemedText>
              </View>
            </ThemedView>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  scrollContent: { flexGrow: 1, alignItems: 'center', paddingBottom: Spacing.four },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  backButton: {
    marginTop: Spacing.three,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateCard: { borderRadius: 16, padding: Spacing.four, gap: 8 },
  stateTitle: { fontSize: 18, lineHeight: 26 },
  reviewCard: { borderRadius: 16, padding: Spacing.four, gap: 6 },
  bookTitle: { fontSize: 13, fontWeight: '700' },
  author: { fontSize: 17, fontWeight: '800' },
  stars: { fontSize: 18, letterSpacing: 2 },
  resenha: { fontSize: 15, lineHeight: 23 },
  conversaHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  conversaTitle: { fontSize: 18, lineHeight: 26 },
  comentario: { borderRadius: 12, padding: Spacing.three, gap: 4 },
  respondendoA: { fontSize: 12, fontWeight: '700' },
  removido: { fontSize: 14, fontStyle: 'italic' },
  comentarioAutor: { fontSize: 14, fontWeight: '800' },
  comentarioTexto: { fontSize: 14, lineHeight: 21 },
  editado: { fontSize: 12 },
  acoes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: 4,
  },
  confirmText: { fontSize: 13, fontWeight: '700' },
  smallButton: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallButtonText: { fontSize: 13, fontWeight: '800' },
  outlineButton: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 14, fontWeight: '800' },
  errorText: { fontSize: 13, lineHeight: 20 },
  composer: { borderTopWidth: 1, alignItems: 'center' },
  composerInner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: 6,
  },
  modoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  modoText: { flex: 1, fontSize: 13, fontWeight: '700' },
  avisoText: { fontSize: 13 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 140,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  sendButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { fontSize: 14, fontWeight: '800' },
  contador: { fontSize: 12, alignSelf: 'flex-end' },
});
