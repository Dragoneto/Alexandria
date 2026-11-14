import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/action-button';
import { AvisoServidorAcordando } from '@/components/aviso-servidor-acordando';
import { AuthShell } from '@/components/auth-shell';
import { PopupCadastroConcluido } from '@/components/popup_cadastro_concluido';
import { TextField } from '@/components/text-field';
import { Accent, DSFonts, Ink, Mint, Space, TextColor } from '@/constants/design-system';
import { PASSWORD_HINT, registerUser } from '@/services/auth';
import { FeedbackPressable } from '@/components/feedback-pressable';

export default function SignUpScreen() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  // Preenchido quando o cadastro dá certo; enquanto não for null, o popup fica aberto
  const [nomeCadastrado, setNomeCadastrado] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setLoading(true);
    setError('');
    try {
      const user = await registerUser({ name, email, password, confirmation });
      setNomeCadastrado(user.name);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível cadastrar.');
    } finally {
      submitting.current = false;
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
          editable={!loading}
          icon={{ ios: 'person.fill', android: 'person', web: 'person' }}
          placeholder="Como quer ser chamado"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
        />

        <TextField
          label="E-mail"
          editable={!loading}
          icon={{ ios: 'envelope.fill', android: 'mail', web: 'mail' }}
          placeholder="voce@email.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
        />

        <TextField
          label="Senha"
          editable={!loading}
          icon={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
          placeholder="Crie uma senha"
          hint={PASSWORD_HINT}
          value={password}
          onChangeText={setPassword}
          secure
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
        />

        <TextField
          label="Confirmar senha"
          editable={!loading}
          icon={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
          placeholder="Repita a senha"
          value={confirmation}
          onChangeText={setConfirmation}
          secure
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={handleSubmit}
        />
      </View>

      <View style={styles.actions}>
        {!!error && (
          <Text accessibilityRole="alert" style={{ color: Accent.coral }}>
            {error}
          </Text>
        )}
        <ActionButton label="Criar conta" onPress={handleSubmit} loading={loading} />
        <AvisoServidorAcordando carregando={loading} />
        <Text style={styles.terms}>
          Ao criar a conta você concorda com os termos de uso e a política de privacidade.
        </Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Já tem conta?</Text>
        <FeedbackPressable
          accessibilityRole="button"
          onPress={() => router.replace('/login')}
          style={styles.footerLinkArea}>
          <Text style={styles.footerLink}>Entrar</Text>
        </FeedbackPressable>
      </View>

      <PopupCadastroConcluido
        visible={nomeCadastrado !== null}
        nome={nomeCadastrado ?? undefined}
        onConfirm={() => {
          setNomeCadastrado(null);
          router.replace({ pathname: '/login', params: { email: email.trim() } });
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
  // Alvo de toque de 44px sem mudar o desenho do link
  footerLinkArea: { minHeight: 44, justifyContent: 'center' },
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
