import { Image } from 'expo-image';
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

const EQUIPE = [
  {
    nome: 'Lauan',
    funcao: 'Back-end',
    descricao: 'Criou o servidor, o login e o banco de dados.',
    cor: Accent.sapphire,
    foto: require('@/assets/images/dev_um.png'),
  },
  {
    nome: 'João Arthur',
    funcao: 'Back-end',
    descricao: 'Desenvolveu a API e organizou como os dados são guardados.',
    cor: Accent.sapphire,
    foto: require('@/assets/images/dev_tres.png'),
  },
  {
    nome: 'Éderson',
    funcao: 'Front-end',
    descricao: 'Construiu as telas do app e a navegação entre elas.',
    cor: Mint.mint400,
    foto: require('@/assets/images/dev_cinco.png'),
  },
  {
    nome: 'Emanuel',
    funcao: 'Design e Front-end',
    descricao: 'Desenhou o visual, as cores e os ícones, e ajudou a montar as telas.',
    cor: Accent.lilac,
    foto: require('@/assets/images/dev_dois.png'),
  },
  {
    nome: 'Davi',
    funcao: 'Gestão de projeto',
    descricao: 'Organizou as tarefas, os prazos e a comunicação da equipe.',
    cor: Accent.amber,
    foto: require('@/assets/images/dev_quatro.png'),
  },
];


export default function EquipeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.tela}>
      <ScrollView contentContainerStyle={styles.conteudo}>
        {/* Botão de voltar (o mesmo das outras telas) */}
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


        {/* Um cartão para cada integrante */}
        <Text style={styles.secaoTitulo}>Equipe</Text>
        {EQUIPE.map((pessoa, index) => (
          <View key={index} style={styles.cartaoPessoa}>
              <View style={styles.avatar}>
                <View style={styles.avatar}>
                  <Image source={pessoa.foto} style={styles.foto} contentFit="cover" />
                </View>
              <Image source={pessoa.foto} style={styles.foto} contentFit="cover" />
            </View>

            <Text style={styles.nome}>{pessoa.nome}</Text>
            <View style={[styles.funcaoSelo, { backgroundColor: withAlpha(pessoa.cor, 0.15) }]}>
              <Text style={[styles.funcaoTexto, { color: pessoa.cor }]}>{pessoa.funcao}</Text>
            </View>
            <Text style={styles.descricao}>{pessoa.descricao}</Text>
          </View>
        ))}

        {/* Agradecimentos */}
        <Text style={styles.secaoTitulo}>Agradecimentos</Text>
        <View style={styles.cartao}>
          <SymbolView
            name={{ ios: 'heart.fill', android: 'favorite', web: 'favorite' }}
            size={20}
            tintColor={Accent.coral}
          />
          <Text style={styles.agradecimento}>
            Obrigado aos professores, colegas e a todos que testaram o app e deram ideias.
          </Text>
        </View>

        <Text style={styles.rodape}>Feito com carinho pela equipe Alexandria</Text>
      </ScrollView>
    </SafeAreaView>
  );

}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: Ink.ink900 },
  conteudo: { padding: ScreenInset, paddingBottom: Space.twelve },
  flex: { flex: 1 },

  // Botão de voltar
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

  // Cabeçalho
  cabecalho: { alignItems: 'center', marginTop: Space.four },
  cabecalhoIcone: {
    width: 80,
    height: 80,
    borderRadius: Radius.pill,
    backgroundColor: withAlpha(Accent.lilac, 0.15),
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: {
    marginTop: Space.four,
    fontFamily: DSFonts.display,
    fontSize: 28,
    color: TextColor.primary,
  },
  subtitulo: {
    marginTop: Space.two,
    fontFamily: DSFonts.ui,
    fontSize: 15,
    color: TextColor.secondary,
    textAlign: 'center',
  },

  // Números
  numeros: { flexDirection: 'row', gap: Space.three, marginTop: Space.six },
  numeroCaixa: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Space.four,
    backgroundColor: Ink.ink700,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Ink.ink500,
  },
  numeroValor: { fontFamily: DSFonts.display, fontSize: 22, color: Mint.mint400 },
  numeroRotulo: {
    marginTop: Space.one,
    fontFamily: DSFonts.ui,
    fontSize: 12,
    color: TextColor.secondary,
  },

  // Títulos das seções
  secaoTitulo: {
    marginTop: Space.eight,
    marginBottom: Space.two,
    fontFamily: DSFonts.ui,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: TextColor.secondary,
  },

  // Cartão de cada pessoa
  cartaoPessoa: {
    alignItems: 'center',
    marginBottom: Space.three,
    padding: Space.six,
    backgroundColor: Ink.ink700,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Ink.ink500,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  foto: { width: '100%', height: '100%' },
  nome: {
    marginTop: Space.four,
    fontFamily: DSFonts.display,
    fontSize: 20,
    color: TextColor.primary,
    textAlign: 'center',
  },
  funcaoSelo: {
    marginTop: Space.two,
    paddingHorizontal: Space.two,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  funcaoTexto: { fontFamily: DSFonts.ui, fontSize: 12, fontWeight: '700' },
  descricao: {
    marginTop: Space.two,
    fontFamily: DSFonts.ui,
    fontSize: 14,
    lineHeight: 20,
    color: TextColor.secondary,
    textAlign: 'center',
  },

  // Agradecimentos
  cartao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.three,
    padding: Space.four,
    backgroundColor: Ink.ink700,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Ink.ink500,
  },
  agradecimento: {
    flex: 1,
    fontFamily: DSFonts.ui,
    fontSize: 15,
    lineHeight: 22,
    color: TextColor.secondary,
  },

  rodape: {
    marginTop: Space.eight,
    textAlign: 'center',
    fontFamily: DSFonts.ui,
    fontSize: 13,
    color: TextColor.muted,
  },
});