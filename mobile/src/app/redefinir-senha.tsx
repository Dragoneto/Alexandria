import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/action-button';
import { AuthShell } from '@/components/auth-shell';
import { TextField } from '@/components/text-field';
import { Accent, DSFonts, Ink, Mint, Space, TextColor } from '@/constants/design-system';
import { ApiError, PASSWORD_HINT, resetPassword } from '@/services/auth';

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
  // O e-mail vem preenchido da tela "Esqueceu a senha?"; o código chega na caixa de entrada
  const params = useLocalSearchParams<{ email?: string }>();

  const [email, setEmail] = useState(params.email ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const submitting = useRef(false);

  const handleChange = (apply: (value: string) => void) => (value: string) => {
    apply(value);
    setError('');
  };

  // Só dígitos, até 6: colar o código do e-mail com espaços também funciona
  const handleChangeCode = handleChange((value) => setCode(value.replace(/\D/g, '').slice(0, 6)));

  const handleSubmit = async () => {
    if (submitting.current) {
      return;
    }

    submitting.current = true;
    setError('');
    setStatus('sending');

    try {
      await resetPassword({ email, code, password, confirmation });
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
      subtitle="Digite o código de 6 dígitos que enviamos para o seu e-mail e escolha a nova senha.">
      <View style={styles.form}>
        <TextField
          label="E-mail"
          icon={{ ios: 'envelope.fill', android: 'mail', web: 'mail' }}
          placeholder="voce@email.com"
          value={email}
          onChangeText={handleChange(setEmail)}
          editable={status !== 'sending'}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
        />

        <TextField
          label="Código"
          icon={{ ios: 'key.fill', android: 'key', web: 'key' }}
          placeholder="000000"
          value={code}
          onChangeText={handleChangeCode}
          editable={status !== 'sending'}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          returnKeyType="next"
        />

        <TextField
          label="Nova senha"
          icon={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
          placeholder="Escolha a nova senha"
          hint={PASSWORD_HINT}
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
        <Text style={styles.footerText}>O código venceu?</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.replace({ pathname: '/esqueci-senha', params: { email: email.trim() } })
          }
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
