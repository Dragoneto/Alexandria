import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { ActionButton } from '@/components/action-button';
import { TextField } from '@/components/text-field';
import {
  Accent,
  DSFonts,
  Ink,
  Radius,
  ScreenInset,
  Shadow,
  Space,
  TextColor,
  withAlpha,
} from '@/constants/design-system';
import type { Progresso } from '@/services/biblioteca';

type PopupProgressoProps = {
  visible: boolean;
  titulo?: string;
  progresso?: Progresso;
  salvando: boolean;
  erro?: string;
  onSalvar: (paginaAtual: number, paginasTotal?: number) => void;
  onFechar: () => void;
};

const MAX_PAGINAS = 100000;

function numero(texto: string): number | null {
  const limpo = texto.trim();
  if (!/^\d{1,6}$/.test(limpo)) return null;
  return Number(limpo);
}

/** Pede a página em que a pessoa está quando o livro vira "Lendo" (e depois, quando ela quiser). */
export function PopupProgresso({
  visible,
  titulo,
  progresso,
  salvando,
  erro,
  onSalvar,
  onFechar,
}: PopupProgressoProps) {
  const [pagina, setPagina] = useState('');
  const [total, setTotal] = useState('');
  const [erroLocal, setErroLocal] = useState('');
  // Celular deitado: campos e botões lado a lado para tudo caber sem rolar.
  const telaBaixa = useWindowDimensions().height < 500;

  // Reabre sempre com os números salvos do livro.
  useEffect(() => {
    if (!visible) return;
    void Promise.resolve().then(() => {
      setPagina(progresso?.paginaAtual ? String(progresso.paginaAtual) : '');
      setTotal(progresso?.paginasTotal ? String(progresso.paginasTotal) : '');
      setErroLocal('');
    });
  }, [visible, progresso?.paginaAtual, progresso?.paginasTotal]);

  const salvar = () => {
    const paginaAtual = numero(pagina || '0');
    const paginasTotal = total.trim() ? numero(total) : null;
    if (paginaAtual === null) return setErroLocal('Digite a página com números, sem pontos.');
    if (total.trim() && (paginasTotal === null || paginasTotal < 1 || paginasTotal > MAX_PAGINAS))
      return setErroLocal('O total de páginas precisa ser um número maior que zero.');
    if (paginasTotal && paginaAtual > paginasTotal)
      return setErroLocal(`A página não pode passar de ${paginasTotal}.`);
    setErroLocal('');
    onSalvar(
      paginaAtual,
      paginasTotal && paginasTotal !== progresso?.paginasTotal ? paginasTotal : undefined,
    );
  };

  const mensagem = erroLocal || erro;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={salvando ? undefined : onFechar}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.View entering={ZoomIn.duration(250)} style={styles.card} accessibilityViewIsModal>
          {/* Os campos rolam em telas baixas; o erro e os botões ficam sempre à vista embaixo. */}
          <ScrollView
            style={styles.rolagem}
            contentContainerStyle={styles.conteudo}
            keyboardShouldPersistTaps="handled">
            <Text style={styles.eyebrow}>Tracker de leitura</Text>
            <Text accessibilityRole="header" style={styles.titulo}>
              Em que página você está?
            </Text>
            {!!titulo && (
              <Text style={styles.livro} numberOfLines={2}>
                {titulo}
              </Text>
            )}

            <View style={[styles.campos, telaBaixa && styles.ladoALado]}>
              <View style={telaBaixa && styles.metade}>
                <TextField
                  label="Página atual"
                  icon={{ ios: 'bookmark.fill', android: 'bookmark', web: 'bookmark' }}
                  placeholder="0"
                  value={pagina}
                  onChangeText={setPagina}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  maxLength={6}
                  editable={!salvando}
                  returnKeyType="done"
                  onSubmitEditing={salvar}
                />
              </View>
              <View style={telaBaixa && styles.metade}>
                <TextField
                  label="Total de páginas"
                  icon={{ ios: 'book.closed.fill', android: 'menu_book', web: 'menu_book' }}
                  placeholder="Ex.: 320"
                  hint={
                    progresso?.paginasTotal
                      ? 'Número da Open Library. Mude se a sua edição for diferente.'
                      : 'A Open Library não informou; preencha se souber.'
                  }
                  value={total}
                  onChangeText={setTotal}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  maxLength={6}
                  editable={!salvando}
                />
              </View>
            </View>

            <Text style={styles.dica}>
              Cada dia em que você abrir o app com este livro em &quot;Lendo&quot; conta como um dia
              de leitura no seu perfil.
            </Text>
          </ScrollView>

          <View style={styles.rodape}>
            {!!mensagem && (
              <Animated.View entering={FadeIn.duration(200)}>
                <Text accessibilityRole="alert" style={styles.erro}>
                  {mensagem}
                </Text>
              </Animated.View>
            )}
            <View style={[styles.acoes, telaBaixa && styles.ladoALado]}>
              <View style={telaBaixa && styles.metade}>
                <ActionButton label="Salvar progresso" onPress={salvar} loading={salvando} />
              </View>
              <View style={telaBaixa && styles.metade}>
                <ActionButton
                  label="Agora não"
                  variant="ghost"
                  onPress={onFechar}
                  disabled={salvando}
                />
              </View>
            </View>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: withAlpha(Ink.ink900, 0.82),
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: ScreenInset,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '92%',
    backgroundColor: Ink.ink700,
    borderRadius: Radius.sheet,
    borderWidth: 1,
    borderColor: Ink.ink500,
    overflow: 'hidden',
    ...Shadow.e2,
  },
  rolagem: { flexGrow: 0, flexShrink: 1 },
  conteudo: { padding: Space.six, paddingBottom: Space.four },
  rodape: { paddingHorizontal: Space.six, paddingBottom: Space.six },
  ladoALado: { flexDirection: 'row' },
  metade: { flex: 1 },
  eyebrow: {
    fontFamily: DSFonts.ui,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: Accent.amber,
  },
  titulo: {
    marginTop: Space.two,
    fontFamily: DSFonts.display,
    fontSize: 22,
    lineHeight: 28,
    color: TextColor.primary,
  },
  livro: {
    marginTop: Space.one,
    fontFamily: DSFonts.ui,
    fontSize: 14,
    lineHeight: 20,
    color: TextColor.secondary,
  },
  campos: { marginTop: Space.four, gap: Space.four },
  dica: {
    marginTop: Space.four,
    fontFamily: DSFonts.ui,
    fontSize: 13,
    lineHeight: 19,
    color: TextColor.secondary,
  },
  erro: {
    marginBottom: Space.three,
    fontFamily: DSFonts.ui,
    fontSize: 13,
    lineHeight: 20,
    color: Accent.coral,
  },
  acoes: { gap: Space.three },
});
