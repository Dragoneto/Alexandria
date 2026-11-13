import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Accent, DSFonts, Ink, Mint, Radius, Space, TextColor } from '@/constants/design-system';
import { porcentagemLida, type Progresso } from '@/services/biblioteca';

type ProgressoDoLivroProps = {
  progresso?: Progresso;
  /** Sem onAtualizar, mostra só a barra (ex.: no perfil). */
  onAtualizar?: () => void;
  compacto?: boolean;
};

function textoDoProgresso(progresso?: Progresso): string {
  const pagina = progresso?.paginaAtual ?? 0;
  const total = progresso?.paginasTotal;
  if (total) return `Página ${pagina} de ${total}`;
  return pagina ? `Página ${pagina}` : 'Nenhuma página anotada';
}

function textoDosDias(dias: number): string {
  return dias === 1 ? '1 dia de leitura' : `${dias} dias de leitura`;
}

/** Barra de progresso de um livro em "Lendo", com páginas e dias de leitura. */
export function ProgressoDoLivro({
  progresso,
  onAtualizar,
  compacto = false,
}: ProgressoDoLivroProps) {
  const porcentagem = porcentagemLida(progresso);
  const dias = progresso?.diasLeitura ?? 0;

  return (
    <View style={[styles.raiz, compacto && styles.compacto]}>
      <View
        style={styles.trilho}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Progresso de leitura"
        accessibilityValue={
          porcentagem === null ? undefined : { min: 0, max: 100, now: porcentagem }
        }>
        <View style={[styles.preenchido, { width: `${porcentagem ?? 0}%` }]} />
      </View>
      <View style={styles.linha}>
        <Text style={styles.texto}>
          {textoDoProgresso(progresso)}
          {porcentagem !== null && <Text style={styles.porcentagem}>{`  ${porcentagem}%`}</Text>}
        </Text>
        <Text style={styles.dias}>{textoDosDias(dias)}</Text>
      </View>
      {onAtualizar && (
        <Pressable
          onPress={onAtualizar}
          accessibilityRole="button"
          accessibilityLabel="Atualizar página em que estou"
          style={({ pressed }) => [styles.botao, pressed && styles.botaoPressionado]}>
          <SymbolView
            name={{ ios: 'bookmark.fill', android: 'bookmark', web: 'bookmark' }}
            size={16}
            tintColor={Mint.mint400}
          />
          <Text style={styles.botaoTexto}>Atualizar progresso</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { gap: Space.two, marginTop: Space.three },
  compacto: { marginTop: Space.two },
  trilho: {
    height: 8,
    borderRadius: Radius.pill,
    backgroundColor: Ink.ink500,
    overflow: 'hidden',
  },
  preenchido: { height: '100%', borderRadius: Radius.pill, backgroundColor: Mint.mint400 },
  linha: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    columnGap: Space.three,
    rowGap: Space.one,
  },
  texto: { fontFamily: DSFonts.ui, fontSize: 13, fontWeight: '600', color: TextColor.primary },
  porcentagem: { color: Mint.mint400, fontWeight: '700' },
  dias: { fontFamily: DSFonts.ui, fontSize: 12, fontWeight: '600', color: Accent.amber },
  botao: {
    alignSelf: 'flex-start',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.two,
  },
  botaoPressionado: { opacity: 0.7 },
  botaoTexto: { fontFamily: DSFonts.ui, fontSize: 14, fontWeight: '700', color: Mint.mint400 },
});
