import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/action-button';
import { DSFonts, Ink, ScreenInset, Space, TextColor } from '@/constants/design-system';

// Substitui a tela padrão do Expo ("Unmatched Route"), que é em inglês e lista todas as rotas.
export default function PaginaNaoEncontrada() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.raiz}>
      <View style={styles.conteudo}>
        <Image
          source={require('@/assets/images/logo_app.png')}
          style={styles.coruja}
          contentFit="contain"
          accessibilityLabel="Coruja do Alexandria"
        />
        <Text accessibilityRole="header" style={styles.titulo}>
          Página não encontrada
        </Text>
        <Text style={styles.texto}>
          Este endereço não existe ou mudou de lugar. Que tal voltar para a sua estante?
        </Text>
        <View style={styles.acoes}>
          {/* "/" leva quem já entrou direto para a home */}
          <ActionButton label="Ir para o início" onPress={() => router.replace('/')} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: Ink.ink900 },
  conteudo: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: ScreenInset,
    gap: Space.four,
  },
  coruja: { width: 96, height: 96 },
  titulo: {
    fontFamily: DSFonts.display,
    fontSize: 26,
    lineHeight: 32,
    color: TextColor.primary,
    textAlign: 'center',
  },
  texto: {
    maxWidth: 320,
    fontFamily: DSFonts.ui,
    fontSize: 15,
    lineHeight: 24,
    color: TextColor.secondary,
    textAlign: 'center',
  },
  acoes: { alignSelf: 'stretch', maxWidth: 400, width: '100%', marginTop: Space.four },
});
