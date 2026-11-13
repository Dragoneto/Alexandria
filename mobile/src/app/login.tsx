import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/action-button';
import { AvisoServidorAcordando } from '@/components/aviso-servidor-acordando';
import { AuthShell } from '@/components/auth-shell';
import { TextField } from '@/components/text-field';
import { Accent, DSFonts, Ink, Mint, Space, TextColor } from '@/constants/design-system';
import { loginUser } from '@/services/auth';

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();

  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);

  const handleSubmit = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setLoading(true);
    setError('');
    try {
      await loginUser(email, password);
      router.replace('/home');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível entrar.');
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Bem-vindo de volta"
      subtitle="Entre para retomar suas leituras e acompanhar a comunidade.">
      <View style={styles.form}>
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
          placeholder="Sua senha"
          value={password}
          onChangeText={setPassword}
          secure
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={handleSubmit}
        />

        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push({ pathname: '/esqueci-senha', params: { email: email.trim() } })
          }
          style={({ pressed }) => [styles.forgot, pressed && styles.pressed]}>
          <Text style={styles.forgotLabel}>Esqueci minha senha</Text>
        </Pressable>
      </View>

      <View style={styles.actions}>
        {!!error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
        <ActionButton label="Entrar" onPress={handleSubmit} loading={loading} />
        <AvisoServidorAcordando carregando={loading} />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Ainda não tem conta?</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/cadastro')}
          style={({ pressed }) => [styles.footerLinkArea, pressed && styles.pressed]}>
          <Text style={styles.footerLink}>Criar conta</Text>
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
  forgot: {
    alignSelf: 'flex-end',
    minHeight: 44,
    justifyContent: 'center',
  },
  // Corpo pequeno · sans 13/20 · 500
  forgotLabel: {
    fontFamily: DSFonts.ui,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
    color: Mint.mint400,
  },
  actions: {
    marginTop: Space.six,
    gap: Space.three,
  },
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
