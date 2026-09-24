import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/action-button';
import { AuthShell } from '@/components/auth-shell';
import { TextField } from '@/components/text-field';
import { Accent, DSFonts, Ink, Mint, Space, TextColor } from '@/constants/design-system';
import { ApiError, MIN_PASSWORD_LENGTH, resetPassword } from '@/services/auth';

type Status = 'idle' | 'sending' | 'done';

/** Traduz a falha do serviço no texto mostrado ao usuário. */
function messageFor(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.kind === 'validation') {
      return error.message;
    }

    if (error.kind === 'network') {
      return 'Não foi possível conectar. Verifique sua internet e tente novamente.';
    }

    if (error.kind === 'timeout') return error.message;
    if (error.status === 404 || error.status === 501) {
      return 'A redefinição de senha ainda não está disponível. Tente novamente mais tarde.';
    }

    if (error.kind === 'config' && __DEV__) {
      return error.message;
    }
  }

  return 'Algo deu errado. Tente novamente em instantes.';
}

export default function ResetPasswordScreen() {
  const router = useRouter();
  // O link do e-mail abre alexandriamobile://redefinir-senha?token=... (e /redefinir-senha?token=... no navegador)
  const params = useLocalSearchParams<{ token?: string }>();
  const tokenFromLink = params.token?.trim() ?? '';

  const [token, setToken] = useState(tokenFromLink);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const submitting = useRef(false);

  const handleChange = (apply: (value: string) => void) => (value: string) => {
    apply(value);
    setError('');
  };

  const handleSubmit = async () => {
    if (submitting.current) {
      return;
    }

    submitting.current = true;
    setError('');
    setStatus('sending');

    try {
      await resetPassword({ token, password, confirmation });
      setStatus('done');
    } catch (resetError) {
      setError(messageFor(resetError));
      setStatus('idle');
    } finally {
      submitting.current = false;
    }
  };

  if (status === 'done') {
    return (
      <AuthShell
        title="Senha redefinida"
        subtitle="Pronto. Agora é só entrar com a senha que você acabou de criar.">
        <View style={styles.actions}>
          <ActionButton label="Entrar" onPress={() => router.replace('/login')} />
        </View>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Criar nova senha"
      subtitle={
        tokenFromLink
          ? 'Escolha a senha que você vai usar para entrar.'
          : 'Cole o código que veio no link do e-mail e escolha a nova senha.'
      }>
      <View style={styles.form}>
        {tokenFromLink ? null : (
          <TextField
            label="Código do link"
            icon={{ ios: 'key.fill', android: 'key', web: 'key' }}
            placeholder="Cole aqui o código recebido"
            value={token}
            onChangeText={handleChange(setToken)}
            editable={status !== 'sending'}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />
        )}

        <TextField
          label="Nova senha"
          icon={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
          placeholder={`Pelo menos ${MIN_PASSWORD_LENGTH} caracteres`}
          value={password}
          onChangeText={handleChange(setPassword)}
          editable={status !== 'sending'}
          secure
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
        />

        <TextField
          label="Confirmar senha"
          icon={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
          placeholder="Repita a nova senha"
          value={confirmation}
          onChangeText={handleChange(setConfirmation)}
          editable={status !== 'sending'}
          secure
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={handleSubmit}
        />
      </View>

      <View style={styles.actions}>
        {error ? (
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
            {error}
          </Text>
        ) : null}

        <ActionButton
          label="Salvar nova senha"
          onPress={handleSubmit}
          loading={status === 'sending'}
        />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>O link venceu?</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/esqueci-senha')}
          style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.footerLink}>Pedir outro</Text>
        </Pressable>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  form: {
    marginTop: Space.eight,
    gap: Space.four,
  },
  actions: {
    marginTop: Space.six,
    gap: Space.four,
  },
  // Corpo pequeno · sans 13/20 · 500, em coral (erro)
  error: {
    fontFamily: DSFonts.ui,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
    color: Accent.coral,
    textAlign: 'center',
  },
  footer: {
    marginTop: Space.eight,
    paddingTop: Space.six,
    borderTopWidth: 1,
    borderTopColor: Ink.ink500,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Space.two,
  },
  footerText: {
    fontFamily: DSFonts.ui,
    fontSize: 15,
    lineHeight: 24,
    color: TextColor.secondary,
  },
  footerLink: {
    fontFamily: DSFonts.ui,
    fontSize: 15,
    lineHeight: 24,
    fontWeight: '700',
    color: Mint.mint400,
  },
  pressed: {
    opacity: 0.6,
  },
});
