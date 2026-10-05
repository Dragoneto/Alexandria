import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Accent,
  DSFonts,
  Ink,
  Mint,
  Radius,
  ScreenInset,
  Space,
  TextColor,
  withAlpha,
} from '@/constants/design-system';
const OPCOES = [
  {
    titulo: 'Sobre o app',
    descricao: 'O que é o Alexandria',
    rota: '/sobre',
    cor: Accent.sapphire,
    icone: { ios: 'info.circle.fill', android: 'info', web: 'info' },
  },
  {
    titulo: 'Equipe',
    descricao: 'Quem fez o app',
    rota: '/equipe',
    cor: Accent.lilac,
    icone: { ios: 'person.3.fill', android: 'groups', web: 'groups' },
  },
  {
    titulo: 'Você sabia?',
    descricao: 'Curiosidades sobre livros',
    rota: '/curiosidades',
    cor: Accent.amber,
    icone: { ios: 'lightbulb.fill', android: 'lightbulb', web: 'lightbulb' },
  },
  {
    titulo: 'Ajuda e FAQ',
    descricao: 'Perguntas frequentes',
    rota: '/ajuda',
    cor: Mint.mint400,
    icone: { ios: 'questionmark.circle.fill', android: 'help', web: 'help' },
  },
] as const;

export default function ConfiguracoesScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.tela}>
      <ScrollView contentContainerStyle={styles.conteudo}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          style={({ pressed }) => [styles.voltar, pressed && styles.voltarPressionado]}>
          <SymbolView
            name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
            size={20}
            tintColor={Mint.mint400}
          />
        </Pressable>

        <Text style={styles.titulo}>Configurações</Text>
        <Text style={styles.subtitulo}>Informações e ajuda sobre o app.</Text>

        {/* Cartão com todas as opções */}
        <View style={styles.cartao}>
          {OPCOES.map((opcao, index) => (
            <Pressable
              key={opcao.titulo}
              onPress={() => router.push(opcao.rota)}
              style={({ pressed }) => [
                styles.linha,
                index > 0 && styles.linhaComBorda,
                pressed && styles.linhaPressionada,
              ]}>
              {/* Ícone dentro de um quadradinho colorido */}
              <View style={[styles.iconeFundo, { backgroundColor: withAlpha(opcao.cor, 0.15) }]}>
                <SymbolView name={opcao.icone} size={20} tintColor={opcao.cor} />
              </View>

              {/* Título e descrição */}
              <View style={styles.textos}>
                <Text style={styles.opcaoTitulo}>{opcao.titulo}</Text>
                <Text style={styles.opcaoDescricao}>{opcao.descricao}</Text>
              </View>

              {/* Setinha */}
              <SymbolView
                name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                size={14}
                tintColor={TextColor.muted}
              />
            </Pressable>
          ))}
        </View>

        <Text style={styles.rodape}>Alexandria · versão 1.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: Ink.ink900 },
  conteudo: { padding: ScreenInset, paddingBottom: Space.eight },

  voltar: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    backgroundColor: Ink.ink700,
    borderWidth: 1,
    borderColor: Ink.ink500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voltarPressionado: { backgroundColor: Ink.ink600 },

  titulo: {
    marginTop: Space.six,
    fontFamily: DSFonts.display,
    fontSize: 28,
    color: TextColor.primary,
  },
  subtitulo: {
    marginTop: Space.two,
    fontFamily: DSFonts.ui,
    fontSize: 15,
    color: TextColor.secondary,
  },

  cartao: {
    marginTop: Space.eight,
    backgroundColor: Ink.ink700,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Ink.ink500,
    overflow: 'hidden',
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.three,
    paddingVertical: Space.four,
    paddingHorizontal: Space.four,
  },
  linhaComBorda: { borderTopWidth: 1, borderTopColor: Ink.ink500 },
  linhaPressionada: { backgroundColor: Ink.ink600 },

  iconeFundo: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textos: { flex: 1 },
  opcaoTitulo: { fontFamily: DSFonts.ui, fontSize: 16, fontWeight: '600', color: TextColor.primary },
  opcaoDescricao: { marginTop: 2, fontFamily: DSFonts.ui, fontSize: 13, color: TextColor.secondary },

  rodape: {
    marginTop: Space.eight,
    textAlign: 'center',
    fontFamily: DSFonts.ui,
    fontSize: 13,
    color: TextColor.muted,
  },
});