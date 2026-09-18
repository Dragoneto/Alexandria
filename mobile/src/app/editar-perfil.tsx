import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/action-button';
import { DSFonts, Ink, Space, TextColor } from '@/constants/design-system';

export default function EditarPerfilScreen() {
  const router = useRouter();

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.flex}>
        <View style={styles.content}>
          <Text style={styles.title}>Editar perfil</Text>
          <Text style={styles.subtitle}>Esta tela ainda está em construção.</Text>
          <ActionButton label="Voltar" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Ink.ink900 },
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: Space.six, gap: Space.four },
  title: {
    fontFamily: DSFonts.display,
    fontSize: 28,
    color: TextColor.primary,
  },
  subtitle: {
    fontFamily: DSFonts.ui,
    fontSize: 15,
    color: TextColor.secondary,
  },
});
