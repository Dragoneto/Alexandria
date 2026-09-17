import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/action-button';
import { AuthShell } from '@/components/auth-shell';
import { TextField } from '@/components/text-field';
import { Accent, DSFonts, Ink, Mint, Space, TextColor } from '@/constants/design-system';
import { ApiError, requestPasswordReset } from '@/services/auth';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Status = 'idle' | 'sending' | 'sent';

/** Traduz a falha do serviço no texto mostrado ao usuário. */
function messageFor(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.kind === 'validation') {
      return error.message;
    }

    if (error.kind === 'network') {
      return 'Não foi possível conectar. Verifique sua internet e tente novamente.';
    }

    if (error.kind === 'config' && __DEV__) {
      return error.message;
    }
  }

  return 'Algo deu errado. Tente novamente em instantes.';
}

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();

  const [email, setEmail] = useState(params.email ?? '');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  const goToLogin = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/login');
    }
  };

  const handleChangeEmail = (value: string) => {
    setEmail(value);
    setError('');
  };

  const handleSubmit = async () => {
    if (status === 'sending') {
      return;
    }

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setError('Informe seu e-mail.');
      return;
    }

    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError('Digite um e-mail válido.');
      return;
    }

    setError('');
    setStatus('sending');

    try {
      // A resposta traz resetToken e resetUrl, que só serão usados na tela de redefinir (#14)
      await requestPasswordReset(trimmedEmail);
      setStatus('sent');
    } catch (requestError) {
      setError(messageFor(requestError));
      setStatus('idle');
    }
  };

  if (status === 'sent') {
    // Mesmo texto para qualquer e-mail, para não revelar quais têm conta
    return (
      <AuthShell
        title="Confira seu e-mail"
        subtitle="Se existir uma conta com esse e-mail, você vai receber um link para criar uma nova senha.">
        <View style={styles.actions}>
          <ActionButton label="Voltar para o login" onPress={goToLogin} />
        </View>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Esqueceu a senha?"
      subtitle="Informe o e-mail da sua conta para receber o link de redefinição.">
      <View style={styles.form}>
        <TextField
          label="E-mail"
          icon={{ ios: 'envelope.fill', android: 'mail', web: 'mail' }}
          placeholder="voce@email.com"
          value={email}
          onChangeText={handleChangeEmail}
          editable={status !== 'sending'}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="send"
          onSubmitEditing={handleSubmit}
        />
      </View>

      <View style={styles.actions}>
        {error ? (
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
            {error}
          </Text>
        ) : null}

        <ActionButton label="Enviar link" onPress={handleSubmit} loading={status === 'sending'} />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Lembrou a senha?</Text>
        <Pressable
          accessibilityRole="button"
          onPress={goToLogin}
          style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.footerLink}>Entrar</Text>
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
