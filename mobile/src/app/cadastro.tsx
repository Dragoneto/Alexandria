import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/action-button';
import { AuthShell } from '@/components/auth-shell';
import { PopupCadastroConcluido } from '@/components/popup_cadastro_concluido';
import { TextField } from '@/components/text-field';
import { Accent, DSFonts, Ink, Mint, Space, TextColor } from '@/constants/design-system';
import { register } from '@/services/auth';
import { saveAuth } from '@/services/auth-storage';
import { fieldErrorsFor, messageFor } from '@/services/error-message';

/** Mesmo mínimo exigido pelo backend. */
const MIN_SENHA = 8;

const CAMPOS = ['name', 'email', 'password', 'confirmation'];

export default function SignUpScreen() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // Preenchido quando o cadastro dá certo; enquanto não for null, o popup fica aberto
  const [nomeCadastrado, setNomeCadastrado] = useState<string | null>(null);

  const clearErrors = (field: string) => {
    setError('');
    setFieldErrors((current) => ({ ...current, [field]: '' }));
  };

  const handleSubmit = async () => {
    if (loading) return;

    const nextFieldErrors: Record<string, string> = {};

    if (!name.trim()) nextFieldErrors.name = 'Informe seu nome.';
    if (!email.trim()) nextFieldErrors.email = 'Informe seu e-mail.';

    if (!password) {
      nextFieldErrors.password = 'Crie uma senha.';
    } else if (password.length < MIN_SENHA) {
      nextFieldErrors.password = `A senha precisa ter ao menos ${MIN_SENHA} caracteres.`;
    }

    if (!confirmation) {
      nextFieldErrors.confirmation = 'Confirme sua senha.';
    } else if (password && password !== confirmation) {
      nextFieldErrors.confirmation = 'As senhas não coincidem.';
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setError('');
      setFieldErrors(nextFieldErrors);
      return;
    }

    setError('');
    setFieldErrors({});
    setLoading(true);

    try {
      const auth = await register(name, email, password);

      await saveAuth({
        token: auth.token,
        id: auth.userId,
        name: auth.name,
        email: auth.email,
      });

      setNomeCadastrado(auth.name);
    } catch (submitError) {
      const fields = fieldErrorsFor(submitError);
      const mostradoNoCampo = Object.keys(fields).some((campo) => CAMPOS.includes(campo));

      setFieldErrors(fields);
      setError(mostradoNoCampo ? '' : messageFor(submitError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Criar sua conta"
      subtitle="Leva menos de um minuto — e sua estante começa a partir de agora.">
      <View style={styles.form}>
        <TextField
          label="Nome"
          icon={{ ios: 'person.fill', android: 'person', web: 'person' }}
          placeholder="Como quer ser chamado"
          value={name}
          onChangeText={(value) => {
            setName(value);
            clearErrors('name');
          }}
          editable={!loading}
          error={fieldErrors.name}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
        />

        <TextField
          label="E-mail"
          icon={{ ios: 'envelope.fill', android: 'mail', web: 'mail' }}
          placeholder="voce@email.com"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            clearErrors('email');
          }}
          editable={!loading}
          error={fieldErrors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
        />

        <TextField
          label="Senha"
          icon={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
          placeholder="Crie uma senha"
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            clearErrors('password');
          }}
          editable={!loading}
          error={fieldErrors.password}
          secure
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
        />

        <TextField
          label="Confirmar senha"
          icon={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
          placeholder="Repita a senha"
          value={confirmation}
          onChangeText={(value) => {
            setConfirmation(value);
            clearErrors('confirmation');
          }}
          editable={!loading}
          error={fieldErrors.confirmation}
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

        <ActionButton label="Criar conta" onPress={handleSubmit} loading={loading} />
        <Text style={styles.terms}>
          Ao criar a conta você concorda com os termos de uso e a política de privacidade.
        </Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Já tem conta?</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/login')}
          style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.footerLink}>Entrar</Text>
        </Pressable>
      </View>

      <PopupCadastroConcluido
        visible={nomeCadastrado !== null}
        nome={nomeCadastrado ?? undefined}
        onConfirm={() => {
          setNomeCadastrado(null);
          router.replace('/login');
        }}
      />
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
  error: {
    fontFamily: DSFonts.ui,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
    color: Accent.coral,
    textAlign: 'center',
  },
  // Corpo pequeno · sans 13/20 · 500
  terms: {
    fontFamily: DSFonts.ui,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
    color: TextColor.secondary,
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
