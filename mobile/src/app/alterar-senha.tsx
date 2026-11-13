import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/action-button';
import { BotaoVoltar } from '@/components/botao-voltar';
import { TextField } from '@/components/text-field';
import {
  Accent,
  DSFonts,
  Ink,
  Mint,
  ScreenInset,
  Space,
  TextColor,
} from '@/constants/design-system';
import { useVoltar } from '@/hooks/use-voltar';
import { ApiError, changePassword, PASSWORD_HINT } from '@/services/auth';

export default function AlterarSenhaScreen() {
  const voltar = useVoltar('/configuracoes');
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);
  const enviando = useRef(false);

  const salvar = async () => {
    if (enviando.current) return;
    enviando.current = true;
    setSalvando(true);
    setErro('');
    setSucesso(false);
    try {
      await changePassword({ currentPassword: atual, password: nova, confirmation: confirmacao });
      setAtual('');
      setNova('');
      setConfirmacao('');
      setSucesso(true);
    } catch (failure) {
      const doCampo =
        failure instanceof ApiError
          ? (failure.fieldErrors?.senhaAtual ?? failure.fieldErrors?.novaSenha)
          : undefined;
      setErro(
        doCampo ??
          (failure instanceof Error ? failure.message : 'Não foi possível alterar a senha.'),
      );
    } finally {
      enviando.current = false;
      setSalvando(false);
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <BotaoVoltar fallback="/configuracoes" style={styles.voltar} />
            <Text style={styles.title}>Alterar senha</Text>
            <Text style={styles.subtitle}>
              Confirme a senha atual e escolha uma nova. Você continua conectado neste aparelho.
            </Text>

            <View style={styles.form}>
              <TextField
                label="Senha atual"
                editable={!salvando}
                icon={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
                placeholder="Sua senha de agora"
                value={atual}
                onChangeText={setAtual}
                secure
                autoCapitalize="none"
                autoComplete="current-password"
                textContentType="password"
              />
              <TextField
                label="Nova senha"
                editable={!salvando}
                icon={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
                placeholder="Escolha a nova senha"
                hint={PASSWORD_HINT}
                value={nova}
                onChangeText={setNova}
                secure
                autoCapitalize="none"
                autoComplete="new-password"
                textContentType="newPassword"
              />
              <TextField
                label="Confirmar nova senha"
                editable={!salvando}
                icon={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
                placeholder="Repita a nova senha"
                value={confirmacao}
                onChangeText={setConfirmacao}
                secure
                autoCapitalize="none"
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="go"
                onSubmitEditing={salvar}
              />
            </View>

            <View style={styles.actions}>
              {!!erro && (
                <Text accessibilityRole="alert" style={styles.error}>
                  {erro}
                </Text>
              )}
              {sucesso && (
                <Text accessibilityRole="alert" style={styles.sucesso}>
                  Senha alterada. Use a nova senha no próximo login.
                </Text>
              )}
              <ActionButton label="Salvar nova senha" onPress={salvar} loading={salvando} />
              <ActionButton label="Voltar" variant="ghost" onPress={voltar} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Ink.ink900 },
  flex: { flex: 1 },
  content: { paddingHorizontal: ScreenInset, paddingTop: Space.eight, paddingBottom: Space.eight },
  voltar: { marginBottom: Space.six },
  title: {
    fontFamily: DSFonts.display,
    fontSize: 28,
    lineHeight: 32,
    color: TextColor.primary,
  },
  subtitle: {
    marginTop: Space.two,
    fontFamily: DSFonts.ui,
    fontSize: 15,
    lineHeight: 24,
    color: TextColor.secondary,
  },
  form: { marginTop: Space.eight, gap: Space.four },
  actions: { marginTop: Space.eight, gap: Space.four },
  error: { fontFamily: DSFonts.ui, fontSize: 13, lineHeight: 20, color: Accent.coral },
  sucesso: { fontFamily: DSFonts.ui, fontSize: 13, lineHeight: 20, color: Mint.mint400 },
});
