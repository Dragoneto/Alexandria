import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/action-button';
import { TextField } from '@/components/text-field';
import { DSFonts, Ink, ScreenInset, Space, TextColor } from '@/constants/design-system';
import { useAuth } from '@/contexts/auth-context';
import { useMessages } from '@/contexts/messages-context';
import { updateProfile } from '@/services/auth';

export default function EditarPerfilScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { success, error: showError } = useMessages();

  // Os campos começam preenchidos com os dados atuais do usuário
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);

  const handleSave = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setSaving(true);
    try {
      await updateProfile({ name, email });
      success('Perfil atualizado.');
      router.back(); // volta para a tela de perfil
    } catch (failure) {
      showError(failure instanceof Error ? failure.message : 'Não foi possível salvar.');
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Editar perfil</Text>
            <Text style={styles.subtitle}>Atualize os dados da sua conta.</Text>

            <View style={styles.form}>
              <TextField
                label="Nome"
                editable={!saving}
                icon={{ ios: 'person.fill', android: 'person', web: 'person' }}
                placeholder="Como quer ser chamado"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoComplete="name"
                maxLength={100}
                returnKeyType="next"
              />

              <TextField
                label="E-mail"
                editable={!saving}
                icon={{ ios: 'envelope.fill', android: 'mail', web: 'mail' }}
                placeholder="voce@email.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />
            </View>

            <View style={styles.actions}>
              <ActionButton label="Salvar alterações" onPress={handleSave} loading={saving} />
              <ActionButton label="Cancelar" variant="ghost" onPress={() => router.back()} />
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
});
