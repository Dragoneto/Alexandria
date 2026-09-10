import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/action-button';
import { AuthShell } from '@/components/auth-shell';
import { TextField } from '@/components/text-field';
import { API_URL } from '@/constants/api';
import { DSFonts, Ink, Mint, Space, TextColor } from '@/constants/design-system';
import { saveAuth } from '@/services/auth-storage';

export default function LoginScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    await saveAuth({
      token: 'mock-token',
      id: 1,
      name: 'Usuário Teste',
      email: 'teste@alexandria.com',
    });

    router.replace('/home');
  };

  return (
    <AuthShell
      title="Bem-vindo de volta"
      subtitle="Entre para retomar suas leituras e acompanhar a comunidade.">
      <View style={styles.form}>
        <TextField
          label="E-mail"
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
        <ActionButton label="Entrar" onPress={handleSubmit} />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Ainda não tem conta?</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/cadastro')}
          style={({ pressed }) => pressed && styles.pressed}>
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
    paddingVertical: Space.two,
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
